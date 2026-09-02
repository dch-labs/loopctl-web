# `src/compact/types.rs` — compaction outcome types

The data shapes that flow between manager, compactor, and driver.

**Key items**

- `CompactionOutcome { messages, tokens_after, tokens_saved, success, error }` + constructors `no_change`, `compacted(before, after)` + static `estimate_tokens` (heuristic hint).
- `EnsureContextResult { Compacted(outcome), NoAction(messages) }` + `into_messages()`.
- `ContextOverflow { tokens_used, context_window, message_count, trigger, compactor_error }` + `overflow()`, `utilization()` (infinity for a zero window).
- `CompactReason { ThresholdExceeded, Emergency, Manual }`.
- `CompactionContext { tokens_before, reason, context_window, turn, counter, instructions, additional_context }` — everything a custom compactor needs.
- `CompactTelemetry` + `PreCompactStats` / `PostCompactStats` — the observer payload.

**Behavior notes**

- A compactor's `tokens_after`/`tokens_saved` are **self-reports** — the manager re-counts and overwrites; fill them using `ctx.counter` so they at least match the unit.
- `CompactReason::Emergency` reaching hooks maps to `CompactTrigger::Auto`; `Manual` stays `Manual`.
- `ContextOverflow` is terminal: the driver maps it to `LoopError::ContextExceeded`.

Deep dive: [Compaction](../02-engine/06-compaction.md).
