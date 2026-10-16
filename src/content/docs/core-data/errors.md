---
title: "Errors"
sidebar:
  order: 5
---

loopctl reports every failure as one type, `LoopError`. No panic escapes the framework, because the crate is compiled with panics denied. Each variant below says when you meet it and whether retrying makes sense. Source: `src/error.rs`.

## Reading the table

Two helper methods answer the questions you would otherwise re-derive by hand:

```rust
if err.is_cancelled() {
    // a clean stop — don't log it as an error
}
if err.is_recoverable() {
    // worth another attempt (maybe after a pause)
}
```

Call `is_cancelled()` before you log anything, because a clean stop is not an error worth an alert. Call `is_recoverable()` when you decide whether to retry, pause, or give up.

## Every variant

| Variant | Payload | When it happens | Recoverable? |
|---|---|---|---|
| `ToolNotFound` | `tool`, `available` | The model asked for a tool that is not registered. The engine normally answers this inside the run, so the model sees the message and self-corrects. You get it as a `LoopError` in direct registry or pipeline use. | no |
| `ToolExecution` | `tool`, `message` | A tool ran and failed hard. | yes |
| `InvalidInput` | message | Caller-supplied input is malformed. Retrying the same input repeats the failure. | no |
| `Api` | message | The provider or HTTP layer failed: network, 5xx, auth. The engine may retry or fall back. | yes |
| `FallbackExhausted` | none | The primary model's breaker is open and every backup model in the chain has failed too. Wait for the cooldown, default 60 s. The next turn probes the primary again. | wait |
| `MaxTurnsExceeded` | `max` | The run hit `RunConfig::max_turns`, default 200. Raise the limit or simplify the task. | config |
| `ContextExceeded` | `used`, `limit` | The conversation outgrew the context window and compaction could not shrink it. `limit` is either the window or the pre-compaction size, so read [compaction](/engine/compaction/) before you trust the number. A provider rejection reporting an oversized prompt now gets one compact-and-retry first, the [overflow salvage](/engine/context-accounting/) path. This error means the rejection repeated. | yes |
| `CompactionFailed` | `used`, `limit` | A compaction pass errored outright. This is a compactor failure, not a shrink to nothing. The payload is payload-comparable to `ContextExceeded` for utilization reporting. | yes |
| `CompactionStalled` | `used`, `limit` | The no-progress guard fired. The pass completed but shaved nothing, so `used >= limit` where `limit` is the pre-pass size. The run ends instead of ping-ponging between Compact and CallLLM. One carve-out: a threshold-triggered pass that declines while the payload still fits the window defers instead of killing the run. | no |
| `BudgetExhausted` | `dimension`, `spent`, `limit` | The [budget gate](/safety/budget-gate/)'s hard line. The next request was refused before it was sent, so nothing is recoverable within the run. | no |
| `LockPoisoned` | `what` | A mutex was poisoned by a panic. Labels you can see: `"fallback"`, `"convergence_detector"`, `"detection_stats"`, `"rate_limit_bucket"`. Restart the subsystem or the session. | no |
| `PhaseFailed` | `phase`, `message` | A named pipeline phase failed. The phase is one of `"pre_process"`, `"reflection"`, `"post_process"`. | depends |
| `Memory` | message | A memory backend failed, in storage or serialization. | depends |
| `Reflection` | message | The failure-analysis cycle itself errored. | yes |
| `Cancelled` | none | The cancel signal fired. This is a clean stop rather than a failure, and partial results may exist. Check with `is_cancelled()`. | n/a |
| `LoopDetected` | `message` | The same tool operation repeated past the stop threshold, default 10. You want this error, because it saves your token budget from a stuck agent. | no |
| `UserInputRequired` | `message` | Convergence detection fired with action `AskUser`. The agent thinks it needs a human. Ask the user, then run again. | human |
| `ToolLimitReached` | `message` | A session or turn tool-call cap was hit. | config |
| `ToolRecoveryExhausted` | `tool`, `attempts` | A failing tool kept being retried past the hard ceiling, `MAX_RECOVERY_ATTEMPTS = 5`. `attempts` counts total calls, so 6 means the original plus 5 retries. Subtract 1 when you report a retry count. | no |
| `StreamError` | message | A streaming reply failed mid-stream. The last complete message survives. | yes |
| `Config` | message | Invalid configuration at startup: zero max turns, empty model name. Fix it before the run starts. | no |
| `Internal` | message | The catch-all. If you see it, something deserves a bug report. | none |
| `RateLimitEscalation` | `attempts`, `retry_after` | The stream handler honored the provider's throttling up to its ceiling and gave up on this model. The engine feeds this into the model breaker, so later turns can route to a fallback. | yes |

## Building a ToolNotFound

Hand this constructor the names you have, and it truncates the list for you:

```rust
// Build a ToolNotFound with a nicely-truncated "available" list
let err = LoopError::tool_not_found("redd_file", &["read_file", "write_file"]);
// → "Tool not found: redd_file. Available: read_file, write_file"
```

The `available` list shows at most 10 names, then `"... (and N more)"`.

### The lock poison policy

This part is background, and you rarely touch it. When a panic happens while a mutex is held, that mutex becomes poisoned, and loopctl splits the handling in two:

- Simple data, such as strings, lists, and maps: the lock is force-recovered with `recover_guard`. The data operations are individually safe, so the show goes on.
- State machines, such as fallback, detection, and rate limiting: poison becomes `LockPoisoned`. Half-updated multi-field state must not be trusted.

That split is why the engine keeps going after a detection lock poisons, because detection is advisory and turns itself off for the session. A fallback poison surfaces as a real error instead.

## Patterns worth copying

Treat cancellation as control flow, not failure:

```rust
match agent.run(input, &config).await {
    Ok(run) => println!("{}", run.output.unwrap_or_default()),
    Err(LoopError::Cancelled) => println!("stopped by user"),
    Err(LoopError::MaxTurnsExceeded { max }) => println!("hit the {}-turn limit", max),
    Err(e) => eprintln!("failed: {e}"),
}
```

Read the order. `Cancelled` gets its own arm before the catch-all, so a user stopping a run does not look like a crash in your logs.

`Run::stop_reason` records the ending for the audit trail. After a run, `agent.session().current_run()` carries `stop_reason: Option<LoopError>`, and `None` means it completed normally.

A run that dies mid-overflow carries its `unfinished_input` through `RunEndContext`, so your host can offer one-click resubmission. Two fields are skipped by serde, `start` and `end`, because timestamps are process-local. Everything durable still serializes.

## Related pages

- [Soft and hard errors](/principles/soft-and-hard-errors/) covers the philosophy that decides which failures reach the model and which reach you.
- [Termination](/engine/termination/) maps every ending to its code path.
- [API client errors](/core-data/api-client/) covers the provider-level classification underneath `Api`.
- [File reference: error.rs](/file-reference/error/)
