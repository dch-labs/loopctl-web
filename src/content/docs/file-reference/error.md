---
title: "`src/error.rs` — `LoopError` and the poison policy"
---


The single error enum for every framework operation, `#[non_exhaustive]`, serde round-trippable, with retry answers built in.

**Key items**

- `LoopError` — 20 variants; see [the errors page](/core-data/errors/) for the full table with triggers.
- `is_recoverable()` — true for `ToolExecution`, `Api`, `ContextExceeded`, `Reflection`, `RateLimitEscalation`.
- `is_cancelled()` — true only for `Cancelled`.
- `LoopError::tool_not_found(tool, available)` — builds the capped availability list (10 names + "... (and N more)").
- `recover_guard(result)` — force-recover a poisoned mutex guard; only for single-operation data (String, Vec, HashMap...).
- `from_poison(what)` — map a lock error to `LockPoisoned { what }`; for multi-field state machines.

**Behavior notes**

- The poison policy is two-handed: simple data gets recovered and the show goes on; state machines (fallback, detection, rate-limit) fail closed as `LockPoisoned` with a fixed label.
- `Cancelled` is a clean stop, not a failure — partial results may exist.
- `ToolRecoveryExhausted.attempts` counts total calls (6 = original + 5 retries).

Deep dive: [Errors](/core-data/errors/).
