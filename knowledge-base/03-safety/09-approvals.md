# Approvals — parking a run for a human, and remembering the answer

Hooks could always `ask`, but the engine's only move was an immediate soft error: an unattended run had no way to *wait* for a decision. 0.4.0 adds the **ask channel** (`src/ask.rs`) — a hook's `Ask` **parks** the run at the pre-execution boundary (the safe point: no tool has run, machine state is coherent) and resumes it on an async answer — plus the **grant store** (`src/tool/grant.rs`), so an approval can outlive the run that earned it.

**Read this if:** your agent runs unattended, approvals arrive by webhook/queue, or you want "ask once, remember."

---

## The lifecycle — park, resolve, resume

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

The pieces:

- **`PendingAsk`** — the serialized question: id (from the id seam), `session_id`/`run_id`/`turn`/`call_id` binding, the call's arguments reduced to the gate records' `args_digest` (arguments never ride the ask), the hook's prompt. Serde types — a host can move approvals across a process boundary.
- **`AskResolver`** — the trait the engine awaits. `SyncAskResolver` adapts an answer-on-sight closure (the old synchronous answerer). **`ApprovalChannel::pair(capacity)`** is the reference implementation: one half parks with the engine, the `Approver` half answers by ask id from wherever your UI lives.
- **`LoopManagers::with_ask_resolver(...)`** installs it; **`with_ask_timeout(duration)`** sets the deadline (no resolver + no deadline = the old byte-identical headless denial, plus one `AskUnresolved` record).

## The guarantees

- **Single-use bindings.** The engine awaits per call; the channel drops its completion slot when the wait ends — a late or duplicate external answer is inert (`Approver::resolve` returns `false`, nothing queues).
- **Fail-closed everywhere.** An approver that is dropped after delivering an ask *denies* it (`Approver`'s `Drop` drains still-awaiting slots to `Deny`) — no run parks forever on an answerer that went away. An expired deadline denies (`AskExpired`, engine-sourced). A cancel during the park ends the run typed `Cancelled` with one `Cancelled` record.
- **Exactly one record per ending.** Denial-family endings emit at the park; the approval's `AskAllowed` record rides the dispatch result and is emitted after dispatch returns — or earlier when the call stops before dispatching (a pre-detection hard stop, the breaker's refusal) or a cancellation cuts the dispatch mid-execution. A consulted-and-approved gate never vanishes from the audit trail.
- **Approval is bound to the args digest.** Approve `Read {path: "a.rs"}`, then the model sends `Read {path: "b.rs"}` — the approver is consulted again with a distinct digest. An approval never carries across calls.
- **The downstream lattice holds.** A hook-approved call still runs the pipeline: a permission middleware's denial displaces the approval's record, exactly one gate record lands (the deciding one).

Parallel dispatch parks one ask per concurrently running call — two concurrent asks both deliver.

---

## The grant store — persisted approvals

The TCC ledger (types always available; the file implementation rides the `file_grants` feature): a `Grant` is a persisted approval rule whose identity is the content-stable 16-hex digest of its `{tool, verdict, scope}` triple — re-granting a rule (including re-approving after a descriptor change) replaces its own entry instead of accumulating duplicates.

```rust
use loopctl::tool::grant::{FileGrantStore, Grant, GrantScope, GrantVerdict};

let store = FileGrantStore::new(root_dir, project_dir)?;   // one project per ledger
store.save(Grant::new("Write", GrantVerdict::Allow,
                      GrantScope::ThisCall { args: json!({...}) }))?;
```

The **narrowness ladder** (`GrantScope`), with mechanical matching:

| Scope | Covers |
|---|---|
| `ThisTool { tool }` | every call to the named tool |
| `ThisCall { args }` | exactly the argument sets canonically equal to the stored one — key order never decides coverage (`Grant::covers`) |

`GrantVerdict` persists denies exactly like allows — deny-over-allow precedence stays *your* policy (the approver's job, the host's ask UX); the store only remembers. Suggesting the narrowest rule for an approval is consumer policy too.

**The rug-pull defense.** `Tool::descriptor_digest()` (default-provided, 16-hex over canonical `{name, description, schema}`) lets first-use approval pin *what the user actually saw*: `Grant::with_pinned_descriptor(digest)`, and a later mismatch — the tool's schema changed — is the re-ask signal, stable across hosts and `serde_json` map backends.

**`FileGrantStore`** binds one project per directory (`<root>/projects/<16-hex project-path digest>/grants.json`, the layout a CLI documents as `~/.local/state/<app>/grants/`): the file is created owner-only `0600`, replaced atomically on every write (a crashed write never leaves a wide staged file). The concurrency contract is single-writer — one process per project; concurrent processes over one project are unsupported (last replace silently wins). `save`/`revoke` return the affected grant so hosts mint the gate-decision audit record; a missing ledger loads as empty. Project identity resolves through a best-effort most-canonical path ladder, so a project bound before its directory exists keeps its ledger after creation in the common cases.

---

## Related pages

- [Permissions](08-permission.md) — the decision vocabulary and the gate-decision records this channel feeds.
- [Hooks](../04-extensions/02-hooks.md) — where an `Ask` originates.
- [The budget gate](10-budget-gate.md) — the other engine-side refusal.
- [File reference: ask.rs](../07-file-reference/ask.md) · [grant.rs](../07-file-reference/tool-grant.md)
