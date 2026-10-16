---
title: "Hooks"
sidebar:
  order: 2
---

[Observers](/extensions/observers/) watch. Hooks decide. A hook can block a tool call before it runs, veto a compaction pass, or steer the summarizer's instructions. Enable the feature with `features = ["hooks"]`. Sources are `src/hooks/`, with the built-ins in `src/hooks/builtin/`.

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

Returning `None` means your hook has no opinion. Here is what a `HookAction` can say:

- **`Allow`** is an explicit allow, and evaluation continues, so later hooks still run.
- **`Block { reason }`** stops the call. It does not run, and the reason becomes a soft error your model reads.
- **`Ask { message }`** needs human confirmation, and it has three possible destinies, listed in order of capability.

The three destinies:

1. A resolver is installed (0.4.0). The run parks at the pre-execution boundary, because the [ask channel](/safety/approvals/) mints a `PendingAsk` and races the resolver against the cancel signal and the ask deadline. The run resumes on the answer, so an unattended run can wait for a webhook.

2. You are interactive with no resolver. The action passes through for a confirmation handler.

3. You are headless with no resolver, which is the default for `BareLoop`. `Ask` is downgraded to `Block`, with your original message preserved in the reason plus one `AskUnresolved` gate record.

## Which hook wins

For pre-tool-use, the first non-Allow decision wins. That first `Block` or `Ask` short-circuits, and your later hooks never see the event. Register your safety-critical hooks first.

An explicit `Allow` never short-circuits, so a later hook can still block.

## Compaction gets more than a yes or no

For compaction, `CompactResult` is richer than a yes/no:
```rust
CompactResult {
    abort: bool,                       // veto this compaction pass entirely
    new_instructions: Option<String>,  // REPLACE the summarizer's instructions
    additional_context: Vec<String>,   // ADD fragments for the summarizer's prompt
}
```

The first `abort` wins. `new_instructions` is last-writer-wins, and each hook sees earlier hooks' instructions accumulated in its context. `additional_context` accumulates from every hook.

The merged guidance genuinely reaches the compactor through `CompactionContext`, so your LLM summarizer can consume it.

## Hooks are synchronous by contract

Do no IO, no network, and no heavy work inside a hook. A hook should block a tool by pattern-matching its name and input, not by looking things up remotely.

Do async work eagerly at registration time instead, or keep a local cache.

### Three precise corners of the executor

- **`Some(Allow)` is skipped, not short-circuited.** The walk continues past an explicit Allow so your later safety hooks still get their say. Only a `Block` or `Ask` result stops it, because first non-Allow decision wins and an Allow is not a decision.

- **No timeout is enforced anywhere.** The executor never wraps your hook in a deadline, because the contract is the guarantee.

- The one number that looks like a timeout is `AutoCommitHook`'s 30 s, and that is a subprocess kill deadline for `git` itself rather than a hook timeout. A hung `git` is killed at 30 s, which is why a failing run-end hook can cost up to that much.

- **The async wrappers are eager.** The executor's async-facing methods run the synchronous body immediately and wrap the finished value in a future. There is no deferred, lazy execution for you to race against the engine.

## The contexts

| Context | Key fields |
|---|---|
| `RunStartContext` | `session_id`, `model`, `working_directory` |
| `RunEndContext` | `reason` as Complete, Cancelled, Error, MaxTurns, or ContextOverflow. Also `total_turns`, `total_tokens`, `duration_secs` |
| `PreToolUseContext` | `tool_name`, `input`, `session_id`, `turn_number`. The input is the exact JSON your tool will receive. |
| `PostToolUseContext` | `tool_name`, `input`, `output`, `is_error`, `duration_ms` |
| `PreCompactContext` | `trigger` as Auto or Manual, `message_count`, `tokens_before`, `context_window`, `custom_instructions` accumulated so far |
| `PostCompactContext` | `messages_compacted`, `tokens_saved`, `tokens_after`, `duration_ms` |

`PreToolUseContext.input` holds the real arguments, so your hooks validate against actual payloads rather than descriptions.

## Wiring

```rust
let mut executor = HookExecutor::new();          // headless by default
executor.register(Arc::new(BlocklistHook::deny(vec!["rm".into()])));
executor.register(Arc::new(my_hook));
agent.set_hook_executor(Arc::new(executor));
```

Those are every engine hook point: before and after each tool attempt, before and after compaction, and run start and run end.

The engine consults your executor exactly when you would expect. Pre-tool runs before dispatch, and a block returns a soft result carrying the reason with zero duration. Pre-compact runs before a pass starts.

## The built-in hooks

### AutoCommitHook: a git trail of agent edits

`AutoCommitHook` tracks the `file_path` values touched by configured tools, which defaults to `Write` and `Edit`. At run end it stages those files and commits them. It really runs `git`, and each call is bounded to 30 seconds and killed on expiry.

```rust
let hook = AutoCommitHook::new();   // or with_config(AutoCommitConfig { ... })
```

Five config fields are worth knowing:

- `message_template` defaults to `"chore(agent): auto-commit"`, and `{{tool}}` and `{{session}}` expand inside it.
- `auto_push` defaults to false.
- `commit_mode` defaults to `Create`. `Amend` rewrites the last commit, so avoid it on shared branches.
- `skip_if_clean` defaults to true.
- `commit_on_tools` defaults to `["Write", "Edit"]`.

The safety rails:

- It stages only recorded files. It never runs `git add -A`, and an empty file list is a hard error by design.
- A clean tree is reported as `NoChanges`.
- Results come back as `AutoCommitResult::Committed`, `NoChanges`, `Skipped`, or `Failed`.
- A hung git operation delays your run completion by up to 30 seconds per call. That is the price of synchronous hooks.

Three execution details are worth having on record:

- It runs `git` inherited from the process working directory. There is no repo discovery, so launch your agent at the repo root or arrange the working directory, or the hook fails with a git error.
- The recorded files come from watching the `file_path` arguments of your configured tools, deduplicated and in first-seen order. Nothing else enters the commit.
- Template expansion handles exactly `{{tool}}` and `{{session}}`. Anything else in braces passes through verbatim, and `Amend` mode is purely a config choice that runs `git commit --amend`, with no age heuristic deciding between amend and create.

### BlocklistHook: name-based gates

```rust
BlocklistHook::deny(vec!["rm".into(), "sudo_bash".into()])       // block these
BlocklistHook::allow_only(vec!["Read".into(), "Grep".into()])    // allow ONLY these
```

Match exact names only, with no patterns. Deny wins on overlap, and an empty allowlist allows everything.

### ConfirmationHook: human in the loop

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

For your listed tools, your handler answers yes or no, and no becomes `Block("User denied permission")`.

The framework never reads stdin and it adds no timeout, so both of those are your handler's business.

### LoggingHook: see the events

`LoggingHook` emits debug-level `tracing` lines for every tool and compaction event. It has no side effects, which makes it a good first hook while you are still learning the surface.

## Hooks, middleware, and observers, the one-line version

| | Can block? | Can modify? | Runs | Best for |
|---|---|---|---|---|
| **Observer** | No | No | After the fact | Logging, metrics, UI |
| **Hook** | Yes, at engine level, first-block-wins | Compaction instructions | Before the fact, synchronously | Session-wide policy, audit gates |
| **[Middleware](/safety/middleware/)** | Yes, at pipeline level | Input and output | Around the tool call | Per-call policy, rewriting, caching |

## Gotchas

- An `Ask` in a headless session without a resolver becomes a `Block`, so `is_block()` on the final action may describe something that started life as an `Ask`.

- The same hook registered twice runs twice per event.

- A pre-compact veto at over-threshold is a decision to stop, because the no-progress guard ends the run. It is not a decision to proceed, so read [compaction](/engine/compaction/) before you rely on a veto.

- Post-tool hooks fire for every executed attempt, retries included. Pre-tool blocks produce no post events for the blocked attempt, because that attempt gets the engine's soft-result treatment instead.

## Related pages

- [Observers](/extensions/observers/) is the watching counterpart.
- [Permission](/safety/permission/) is the pipeline-level gate.
