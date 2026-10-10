# `src/observer/context.rs` — observer event payloads

Every context struct an observer can receive, all `Debug + Clone`, all fields public, delivered by reference.

**Key items**

- Run/turn: `RunStartContext { session_id }`, `RunEndContext { success, error, total_turns, duration_ms, calibration_ratio_bp, context_figure, unfinished_input }` (the last three 0.4.0), `TurnStartContext { turn, query }`, `TurnEndContext { turn, success, error, duration_ms, input_tokens, output_tokens, stop_reason, history, context_tokens, context_window }` (the last four 0.4.0; `history` = the machine's conversation at the boundary, `Arc`-shared).
- Model: `StreamContext { turn, model, usage }`, `StreamFailureContext { turn, model, error }`, `ResponseContext { turn, text, usage }`, `FallbackContext { from, to }`, `ModelSwitchedContext { from, to }`, `TransportFallbackContext` (0.4.0), `BudgetWarnContext` (0.4.0).
- Streaming: `TextDeltaContext { turn, delta }`, `ThinkingDeltaContext { turn, delta }` (empty delta = redacted reasoning), `AttemptResetContext` (0.4.0 — once per retried attempt).
- Tools: `ToolCallReceivedContext { turn, tool, call_id, input }`, `ToolPreContext { turn, tool, tool_call_id }`, `ToolPostContext` (`#[non_exhaustive]`: + `result_hash`, `is_error`, `duration`, `display_hint`), `GateDecisionContext { turn, call_id, decision }` (0.4.0).
- Compaction/detection: `PreCompactionContext` (0.4.0 — the pass is starting), `CompactedContext` (carrying live `CompactTelemetry` since 0.4.0), `CompactionFailedContext` (0.4.0), `LoopDetectedContext { pattern, repetitions }`, `ConvergenceDetectedContext { action }`.

**Behavior notes**

- Pair tool pre/post by `tool_call_id`, never arrival order or `(turn, tool)`.
- `total_turns` at run end counts only finished turns.
- `CompactedContext.tokens_before` is reconstructed (after + saved) and excludes transients.

Deep dive: [Observers](../04-extensions/01-observers.md).
