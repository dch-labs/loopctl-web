---
title: "Hooks — allow, block, or steer before things happen [feature: hooks]"
sidebar:
  order: 2
---


[Observers](/extensions/observers/) watch. **Hooks decide.** A hook can block a tool call before it runs, veto a compaction pass, or steer the summarizer's instructions. Enable with `features = ["hooks"]`. Sources: `src/hooks/`, built-ins in `src/hooks/builtin/`.

---

## The trait and the actions

```rust
pub trait Hook: Send + Sync {
    fn name(&self) -> &str;                                             // required
    fn on_pre_tool_use(&self, ctx: &PreToolUseContext) -> Option<HookAction> { None }
    fn on_pre_compact(&self, ctx: &PreCompactContext) -> Option<CompactResult> { None }
    fn on_post_tool_use(&self, ctx: &PostToolUseContext) {}
    fn on_post_compact(&self, ctx: &PostCompactContext) {}
    fn on_run_start(&self, ctx: &RunStartContext) {}
    fn on_run_end(&self, ctx: &RunEndContext) {}
}
```

`None` means "no opinion." `HookAction`:

- **`Allow`** — explicit allow; evaluation continues (later hooks still run).
- **`Block { reason }`** — stop: the call does not run; the reason becomes a soft error the model reads.
- **`Ask { message }`** — needs human confirmation. In a **headless** session (the default for `BareLoop`), `Ask` is automatically **downgraded to `Block`** — with the original message preserved in the reason. In `Interactive` mode it passes through for a confirmation handler.

**First non-Allow wins** for pre-tool-use: the first `Block`/`Ask` short-circuits, later hooks never see the event. Register safety-critical hooks first. Explicit `Allow` never short-circuits — a later hook can still block.

For compaction, `CompactResult` is richer than a yes/no:

```rust
CompactResult {
    abort: bool,                       // veto this compaction pass entirely
    new_instructions: Option<String>,  // REPLACE the summarizer's instructions
    additional_context: Vec<String>,   // ADD fragments for the summarizer's prompt
}
```

First `abort` wins; `new_instructions` is last-writer-wins (each hook sees earlier hooks' instructions accumulated in its context); `additional_context` accumulates from every hook. The merged guidance genuinely reaches the compactor through `CompactionContext` — an LLM summarizer can consume it.

**Hooks are synchronous by contract.** No IO, no network, no heavy work — a hook blocks a tool by pattern-matching its name/input, not by looking things up remotely. Do async work eagerly at registration time, or keep a local cache.

### The executor, exactly

The semantics have three precise corners worth knowing:

- **`Some(Allow)` is skipped, not short-circuited.** The walk continues past an explicit Allow so later safety hooks still get their say; only a `Block`/`Ask` result stops it. ("First non-Allow **decision** wins" — an Allow isn't a decision.)
- **No timeout is enforced — anywhere.** The executor never wraps your hook in a deadline; the contract *is* the guarantee. (The one number that looks like one — `AutoCommitHook`'s 30 s — is a subprocess kill deadline for `git` itself, not a hook timeout: a hung `git` is killed at 30 s, which is why a failing run-end hook can cost up to that much.)
- **The async wrappers are eager.** Internally the executor's async-facing methods run the synchronous body immediately and wrap the finished value in a future — there is no deferred, lazy execution to race against the engine.

## The contexts

| Context | Key fields |
|---|---|
| `RunStartContext` | `session_id`, `model`, `working_directory` |
| `RunEndContext` | `reason` (Complete/Cancelled/Error/MaxTurns/ContextOverflow), `total_turns`, `total_tokens`, `duration_secs` |
| `PreToolUseContext` | `tool_name`, `input` (the exact JSON the tool will receive), `session_id`, `turn_number` |
| `PostToolUseContext` | `tool_name`, `input`, `output`, `is_error`, `duration_ms` |
| `PreCompactContext` | `trigger` (Auto/Manual), `message_count`, `tokens_before`, `context_window`, `custom_instructions` (accumulated so far) |
| `PostCompactContext` | `messages_compacted`, `tokens_saved`, `tokens_after`, `duration_ms` |

`PreToolUseContext.input` is the real arguments — hooks validate against actual payloads, not descriptions.

## Wiring

```rust
let mut executor = HookExecutor::new();          // headless by default
executor.register(Arc::new(BlocklistHook::deny(vec!["rm".into()])));
executor.register(Arc::new(my_hook));
agent.set_hook_executor(Arc::new(executor));
```

Every engine hook point: before/after each tool attempt, before/after compaction, run start/end. The engine consults the executor at exactly the moments you'd expect — pre-tool before dispatch (a block returns a soft result with the reason, zero duration), pre-compact before a pass runs.

---

## The built-in hooks

### `AutoCommitHook` — a git trail of agent edits

Tracks `file_path`s touched by configured tools (`Write`, `Edit` by default) and, at run end, stages and commits exactly those files. Yes — it really runs `git` (each call bounded to 30s, killed on expiry).

```rust
let hook = AutoCommitHook::new();   // or with_config(AutoCommitConfig { ... })
```

Config worth knowing: `message_template` (default `"chore(agent): auto-commit"`; `{{tool}}` and `{{session}}` expand), `auto_push` (default false), `commit_mode` (`Create` default; `Amend` rewrites the last commit — avoid on shared branches), `skip_if_clean` (default true), `commit_on_tools` (default `["Write", "Edit"]`).

Safety rails: it stages **only recorded files** — never `git add -A` (an empty file list is a hard error, by design); a clean tree is reported as `NoChanges`; results come back as `AutoCommitResult::Committed { sha } | NoChanges | Skipped | Failed`. A hung git op delays run completion up to 30s per call — that's the price of synchronous hooks.

Execution details worth having on record: it runs `git` **inherited from the process working directory** — there is no repo discovery, so launch your agent at the repo root (or arrange the CWD) or the hook fails with a git error. The recorded files come from watching configured tools' `file_path` arguments (deduplicated, in first-seen order) — nothing else enters the commit. The template expansion handles exactly `{{tool}}` and `{{session}}` (anything else in braces passes through verbatim), and `Amend` mode is purely a config choice (`git commit --amend`) — there's no age heuristic deciding between amend and create.

### `BlocklistHook` — name-based gates

```rust
BlocklistHook::deny(vec!["rm".into(), "sudo_bash".into()])       // block these
BlocklistHook::allow_only(vec!["Read".into(), "Grep".into()])    // allow ONLY these
```

Exact names only, no patterns. Deny wins on overlap; an **empty** allowlist allows everything.

### `ConfirmationHook` — human in the loop

```rust
struct TerminalPrompt;
impl ConfirmationHandler for TerminalPrompt {
    fn confirm(&self, message: &str) -> bool {
        print!("{message} [y/N] "); // your UI — CLI, TUI, webhook, anything
        read_answer()
    }
}
ConfirmationHook::new(vec!["Bash".into()], Arc::new(TerminalPrompt))
```

For listed tools: your handler answers yes/no; no → `Block("User denied permission")`. The framework never reads stdin and adds no timeout — both are your handler's business.

### `LoggingHook` — see the events

Debug-level `tracing` lines for every tool/compact event. No side effects; perfect first hook while learning.

---

## Hooks vs middleware vs observers — the one-line version

| | Can block? | Can modify? | Runs | Best for |
|---|---|---|---|---|
| **Observer** | no | no | after the fact | logging, metrics, UI |
| **Hook** | yes (engine-level, first-block-wins) | compaction instructions | before the fact, synchronous | session-wide policy, audit gates |
| **[Middleware](/safety/middleware/)** | yes (pipeline-level) | input *and* output | around the tool call | per-call policy, rewriting, caching |

---

## Gotchas

- `Ask` in a headless session becomes `Block` — `is_block()` on the final action may have started life as `Ask`.
- The same hook registered twice runs twice per event.
- A pre-compact veto at over-threshold is a decision to **stop** (the no-progress guard ends the run), not a decision to proceed — see [compaction](/engine/compaction/).
- Post-tool hooks fire for every executed attempt (retries included); pre-tool blocks do not produce post events for the blocked attempt — they get the engine's soft-result treatment instead.

---

## Related pages

- [Observers](/extensions/observers/) — the watching counterpart.
- [Permission](/safety/permission/) — the pipeline-level gate.
