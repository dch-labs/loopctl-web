# Errors — one enum for everything that can go wrong

loopctl uses a single error type, `LoopError`, for every operation. No panic ever escapes the framework (the crate is compiled with panics denied). This page lists every variant, when you'll see it, and whether retrying makes sense. Source: `src/error.rs`.

---

## Reading the table

The two helper methods answer the questions you'd otherwise re-derive by hand:

```rust
if err.is_cancelled() {
    // a clean stop — don't log it as an error
}
if err.is_recoverable() {
    // worth another attempt (maybe after a pause)
}
```

---

## Every variant

| Variant | Payload | When it happens | Recoverable? |
|---|---|---|---|
| `ToolNotFound` | `tool`, `available` | The model asked for a tool that isn't registered. Normally the engine answers this *inside* the run (the model sees the message and self-corrects); as a `LoopError` it appears in direct registry/pipeline use. | no |
| `ToolExecution` | `tool`, `message` | A tool ran and failed hard. | yes |
| `InvalidInput` | message | Caller-supplied input is malformed. Retrying the same input repeats the failure. | no |
| `Api` | message | The provider/HTTP layer failed (network, 5xx, auth...). The engine may retry or fall back. | yes |
| `FallbackExhausted` | — | The primary model's breaker is open **and** every backup model in the chain has failed too. Wait for the cooldown (default 60 s) — the next turn probes the primary. | (wait) |
| `MaxTurnsExceeded` | `max` | The run hit `RunConfig::max_turns` (default 200). Raise the limit or simplify the task. | config |
| `ContextExceeded` | `used`, `limit` | The conversation outgrew the context window and compaction could not shrink it. `limit` is either the window or the pre-compaction size (see [compaction](../02-engine/06-compaction.md)). | yes |
| `LockPoisoned` | `what` | A mutex was poisoned by a panic (labels: `"fallback"`, `"convergence_detector"`, `"detection_stats"`, `"rate_limit_bucket"`). Restart the subsystem or the session. | no |
| `PhaseFailed` | `phase`, `message` | A named pipeline phase failed (`"pre_process"`, `"reflection"`, `"post_process"`). | depends |
| `Memory` | message | A memory backend failed (storage, serialization). | depends |
| `Reflection` | message | The failure-analysis cycle itself errored. | yes |
| `Cancelled` | — | The cancel signal fired. **A clean stop, not a failure** — partial results may exist. Check with `is_cancelled()`. | n/a |
| `LoopDetected` | `message` | The same tool operation repeated past the stop threshold (default 10). Saves your token budget from a stuck agent. | no |
| `UserInputRequired` | `message` | Convergence detection with action `AskUser` fired: the agent thinks it needs a human. Ask the user, then run again. | human |
| `ToolLimitReached` | `message` | A session/turn tool-call cap was hit. | config |
| `ToolRecoveryExhausted` | `tool`, `attempts` | A failing tool kept being retried past the hard ceiling (`MAX_RECOVERY_ATTEMPTS = 5`). `attempts` counts **total calls** (6 = original + 5 retries); subtract 1 for the retry count. | no |
| `StreamError` | message | A streaming reply failed mid-stream. The last complete message survives. | yes |
| `Config` | message | Invalid configuration at startup (zero max turns, empty model name...). | no |
| `Internal` | message | Catch-all. If you see it, something deserves a bug report. | — |
| `RateLimitEscalation` | `attempts`, `retry_after` | The stream handler honored the provider's throttling up to its ceiling and gave up on this model. The engine feeds this into the model breaker so later turns can route to a fallback. | yes |

---

## Two useful constructors and helpers

```rust
// Build a ToolNotFound with a nicely-truncated "available" list
let err = LoopError::tool_not_found("redd_file", &["read_file", "write_file"]);
// → "Tool not found: redd_file. Available: read_file, write_file"
```

The `available` list shows at most 10 names, then `"... (and N more)"`.

### The lock-poison policy (background, rarely needed)

When a panic happens while a mutex is held, the mutex becomes "poisoned." loopctl splits handling in two:

- **Simple data** (strings, lists, maps): the lock is force-recovered (`recover_guard`) — the data operations are individually safe, so the show goes on.
- **State machines** (fallback, detection, rate limiting): poison becomes `LockPoisoned` — half-updated multi-field state must not be trusted.

This is why the engine can keep going after a detection lock poisons (detection is advisory and simply turns itself off for the session), while a fallback poison surfaces as a real error.

---

## Patterns worth copying

**Treat cancellation as control flow, not failure:**

```rust
match agent.run(input, &config).await {
    Ok(run) => println!("{}", run.output.unwrap_or_default()),
    Err(LoopError::Cancelled) => println!("stopped by user"),
    Err(LoopError::MaxTurnsExceeded { max }) => println!("hit the {}-turn limit", max),
    Err(e) => eprintln!("failed: {e}"),
}
```

**`Run::stop_reason` records the ending for the audit trail.** After a run, `agent.session().current_run()` carries `stop_reason: Option<LoopError>` — `None` means it completed normally. Timestamps (`start`, `end`) are skipped by serde (they're process-local), but everything durable serializes.

---

## Related pages

- [Soft and hard errors](../09-principles/04-soft-and-hard-errors.md) — the philosophy that decides which failures reach the model and which reach you.
- [Termination](../02-engine/07-termination.md) — every ending mapped to its code path.
- [API client errors](03-api-client.md) — the provider-level classification underneath `Api`.
- [File reference: error.rs](../07-file-reference/error.md)
