---
title: "src/compact/types.rs"
---

This file holds the data shapes that flow between your manager, compactor, and driver.

## Key items

`CompactionOutcome { messages, tokens_after, tokens_saved, success, error }` is a compactor's answer. Build one with the `no_change` or `compacted(before, after)` constructors, and use the static `estimate_tokens` as a heuristic hint.

`EnsureContextResult { Compacted(outcome), NoAction(messages) }` is what your manager hands the driver, and `into_messages()` unwraps it.

`ContextOverflow { tokens_used, context_window, message_count, trigger, compactor_error }` describes a refusal. You build it with `overflow()` and read `utilization()`, which returns infinity for a zero window.

`CompactReason { ThresholdExceeded, Emergency, Manual }` says why a pass ran.

`CompactionContext { tokens_before, reason, context_window, turn, counter, instructions, additional_context }` carries everything a custom compactor needs.

`CompactTelemetry`, with `PreCompactStats` and `PostCompactStats`, is your observer payload. It has been live since 0.4.0 and carries trigger, before and after stats, savings, and the pass's wall-clock duration measured around snapshot, counting, compactor, and demotion handoff.

It is `#[non_exhaustive]`, produced by the machinery and read by hosts like you.

## Behavior notes

A compactor's `tokens_after` and `tokens_saved` are self-reports, so the manager re-counts and overwrites them. Fill them using `ctx.counter` so they at least match the unit.

`CompactReason::Emergency` reaching your hooks maps to `CompactTrigger::Auto`, and `Manual` stays `Manual`.

`ContextOverflow` is terminal: your driver maps it to `LoopError::ContextExceeded`.

Deep dive: [Compaction](/engine/compaction/).
