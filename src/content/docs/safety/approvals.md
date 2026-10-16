---
title: "Approvals"
sidebar:
  order: 9
---

A hook has always been able to `ask`, but the engine's only move was an immediate soft error. An unattended run had no way to wait for a decision. Two pieces close that gap.

The ask channel arrived in 0.4.0. It parks the run at the pre-execution boundary when a hook returns `Ask`, then resumes it on an async answer. That boundary is the safe point: no tool has run, and machine state is coherent.

The grant store then lets an approval outlive the run that earned it. Source: `src/ask.rs` and `src/tool/grant.rs`.

Read this page if your agent runs unattended, if approvals reach you by webhook or queue, or if you want to ask once and remember.

## Park, resolve, resume

```mermaid
sequenceDiagram
    participant M as model
    participant E as engine
    participant R as resolver (your side)
    M->>E: tool call (hook says Ask)
    E->>E: mint PendingAsk (id, session/run/turn/call binding,
            args_digest — never the arguments, the hook's prompt)
    E->>R: resolver.resolve(pending_ask) — or wait for approval
    Note over E: the run is PARKED — nothing executes
    alt approved
        R-->>E: AskResolution::Approve
        E->>E: run the call through the unchanged pipeline
        E->>E: one AskAllowed gate record after dispatch
    else refused / expired / cancelled
        R-->>E: Deny / deadline / cancel
        E->>M: soft denial the model reacts to
        E->>E: one record: AskDenied / AskExpired / Cancelled
    end
```

## The three pieces

### PendingAsk

`PendingAsk` is the serialized question. It carries an id from the id seam, the `session_id`, `run_id`, `turn`, and `call_id` binding, and the hook's prompt.

The call's arguments are reduced to the `args_digest` the gate records already use, so arguments never ride the ask. Every field is a serde type, so you can move approvals across a process boundary.

### AskResolver

`AskResolver` is the trait the engine awaits. `SyncAskResolver` adapts an answer-on-sight closure, which is the old synchronous answerer.

`ApprovalChannel::pair(capacity)` is the reference implementation. One half parks with the engine, and the `Approver` half answers by ask id from wherever your UI lives.

### Installing it

You install a resolver with `LoopManagers::with_ask_resolver(...)` and set a deadline with `with_ask_timeout(duration)`. No resolver and no deadline gives you the old headless denial, byte-identical, plus one `AskUnresolved` record.

## The guarantees

- **Single-use bindings.** The engine awaits per call, and the channel drops its completion slot when the wait ends. A late or duplicate answer from your side is inert, so `Approver::resolve` returns `false` and nothing queues.
- **Fail-closed everywhere.** An approver dropped after delivering an ask denies it, because `Approver`'s `Drop` drains still-awaiting slots to `Deny`. No run parks forever on an answerer that went away.
- **Deadlines and cancels deny.** An expired deadline denies with `AskExpired`, sourced by the engine. A cancel during the park ends the run typed `Cancelled`, with one `Cancelled` record.
- **One record per ending.** Denial-family endings emit at the park. The approval's `AskAllowed` record rides the dispatch result and emits after dispatch returns.
- **Early stops still record.** When a call stops before dispatching, a pre-detection hard stop or the breaker's refusal, that record lands earlier. A cancellation that cuts dispatch mid-execution is handled the same way.
- **The audit trail is complete.** A gate you consulted and approved never vanishes from it.
- **Approval is bound to the args digest.** Approve `Read {path: "a.rs"}`, then let the model send `Read {path: "b.rs"}`, and the approver is consulted again with a distinct digest. An approval never carries across calls.
- **The downstream lattice holds.** A hook-approved call still runs the pipeline. A permission middleware's denial displaces the approval's record, and exactly one gate record lands, the deciding one.

Parallel dispatch parks one ask per call that runs concurrently, so two concurrent asks both deliver.

## The grant store

The grant store is a TCC-style ledger of persisted approvals. The types are always available, and the file implementation rides the `file_grants` feature.

A `Grant` is a persisted approval rule, and its identity is the content-stable 16-hex digest of its `{tool, verdict, scope}` triple. Re-granting a rule replaces its own entry instead of accumulating duplicates, and that includes re-approving after the tool's descriptor changed.

```rust
use loopctl::tool::grant::{FileGrantStore, Grant, GrantScope, GrantVerdict};

let store = FileGrantStore::new(root_dir, project_dir)?;   // one project per ledger
store.save(Grant::new("Write", GrantVerdict::Allow,
                      GrantScope::ThisCall { args: json!({...}) }))?;
```

### The narrowness ladder

`GrantScope` has two rungs, and matching is mechanical:

| Scope | Covers |
|---|---|
| `ThisTool { tool }` | Every call to the named tool. |
| `ThisCall { args }` | Exactly the argument sets canonically equal to the stored one, so key order never decides coverage. `Grant::covers` does the comparison. |

`GrantVerdict` persists denies exactly like allows. Deny-over-allow precedence stays your policy, because that is the approver's job and your ask UX, and the store only remembers. Suggesting the narrowest rule for an approval is consumer policy too.

### Pin what the user saw

This is the rug-pull defense. `Tool::descriptor_digest()` is default-provided and returns a 16-hex digest over the canonical `{name, description, schema}`. It lets a first-use approval pin what the human actually saw, by storing it with `Grant::with_pinned_descriptor(digest)`.

A later mismatch means the tool's schema changed, and that mismatch is your re-ask signal. The digest is stable across hosts and `serde_json` map backends.

### The file layout

`FileGrantStore` binds one project per directory at `<root>/projects/<16-hex project-path digest>/grants.json`. A CLI documents that layout as `~/.local/state/<app>/grants/`.

The file is created owner-only `0600` and replaced atomically on every write, so a crashed write never leaves a wide staged file.

The concurrency contract is single-writer: one process per project. Concurrent processes over one project are unsupported, and the last replace silently wins.

`save` and `revoke` return the affected grant, so you can mint the gate-decision audit record yourself. A missing ledger loads as empty.

Project identity resolves through a best-effort most-canonical path ladder. A project you bound before its directory existed keeps its ledger once that directory is created, in the common cases.

## Related pages

- [Permissions](/safety/permission/) covers the decision vocabulary and the gate-decision records this channel feeds.
- [Hooks](/extensions/hooks/) covers where an `Ask` originates.
- [The budget gate](/safety/budget-gate/) is the other engine-side refusal.
- [File reference: ask.rs](/file-reference/ask/) and [grant.rs](/file-reference/tool-grant/)
