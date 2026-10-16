---
title: "src/observer/context.rs"
---

This file holds every context struct an observer of yours can receive. They are all `Debug + Clone`, all fields are public, and they are delivered by reference.

## Key items

For the run/turn group you get `RunStartContext { session_id }` and `RunEndContext { success, error, total_turns, duration_ms, calibration_ratio_bp, context_figure, unfinished_input }`, where the last three arrived in 0.4.0.

Your turn payloads are `TurnStartContext { turn, query }` and `TurnEndContext { turn, success, error, duration_ms, input_tokens, output_tokens, stop_reason, history, context_tokens, context_window }`, where the last four arrived in 0.4.0.

In that last struct, `history` is the machine's conversation at the boundary and is `Arc`-shared.

For model events you get `StreamContext { turn, model, usage }`, `StreamFailureContext { turn, model, error }`, `ResponseContext { turn, text, usage }`, and `FallbackContext { from, to }`.

There is also `ModelSwitchedContext { from, to }`, plus `TransportFallbackContext` and `BudgetWarnContext`, both new in 0.4.0.

For streaming you get `TextDeltaContext { turn, delta }` and `ThinkingDeltaContext { turn, delta }`, where an empty delta means redacted reasoning. `AttemptResetContext` arrived in 0.4.0 and fires once per retried attempt.

For tools you get `ToolCallReceivedContext { turn, tool, call_id, input }` and `ToolPreContext { turn, tool, tool_call_id }`.

`ToolPostContext` is `#[non_exhaustive]` and adds `result_hash`, `is_error`, `duration`, and `display_hint`. `GateDecisionContext { turn, call_id, decision }` arrived in 0.4.0.

For compaction and detection you get `PreCompactionContext`, new in 0.4.0, which says the pass is starting, and `CompactedContext`, which carries live `CompactTelemetry` since 0.4.0.

`CompactionFailedContext` is also new in 0.4.0, and you also get `LoopDetectedContext { pattern, repetitions }` and `ConvergenceDetectedContext { action }`.

## Behavior notes

Pair your tool pre/post events by `tool_call_id`, never by arrival order or by a `(turn, tool)` pair.

`total_turns` at run end counts only finished turns.

`CompactedContext.tokens_before` is reconstructed as after plus saved, and it excludes transients.

For the deep dive, see [Observers](/extensions/observers/).
