---
title: "src/error.rs"
---

This file holds your single error enum for every framework operation. `LoopError` is `#[non_exhaustive]`, serde round-trippable, and ships retry answers built in.

## Key items

`LoopError` has 23 variants, and 0.4.0 adds `CompactionFailed`, `CompactionStalled`, and `BudgetExhausted`. See [the errors page](/core-data/errors/) for the full table with triggers.

`is_recoverable()` returns true for `ToolExecution`, `Api`, `ContextExceeded`, `Reflection`, and `RateLimitEscalation`.

`is_cancelled()` returns true only for `Cancelled`.

`LoopError::tool_not_found(tool, available)` builds your capped availability list: 10 names plus "... (and N more)".

`recover_guard(result)` force-recovers a poisoned mutex guard, and belongs on single-operation data such as String, Vec, or HashMap.

`from_poison(what)` maps a lock error to `LockPoisoned { what }`, which is what multi-field state machines want.

## Behavior notes

Your poison policy is two-handed. Simple data gets recovered and the show goes on, while state machines such as fallback, detection, and rate-limit fail closed as `LockPoisoned` with a fixed label.

`Cancelled` is a clean stop, not a failure, so partial results may exist.

`ToolRecoveryExhausted.attempts` counts total calls, meaning 6 is original plus 5 retries.

Deep dive: [Errors](/core-data/errors/).
