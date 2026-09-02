# `src/observer/context.rs` — observer event payloads

Every context struct an observer can receive, all `Debug + Clone`, all fields public, delivered by reference.

**Key items**

- Run/turn: `RunStartContext { session_id }`, `RunEndContext { success, error, total_turns, duration_ms }`, `TurnStartContext { turn, query }`, `TurnEndContext { turn, success, error, duration_ms, input_tokens, output_tokens }`.
- Model: `StreamContext { turn, model, usage }`, `StreamFailureContext { turn, model, error }`, `ResponseContext { turn, text, usage }`, `FallbackContext { from, to }`, `ModelSwitchedContext { from, to }`.
- Streaming: `TextDeltaContext { turn, delta }`, `ThinkingDeltaContext { turn, delta }` (empty delta = redacted reasoning).
- Tools: `ToolCallReceivedContext { turn, tool, call_id, input }`, `ToolPreContext { turn, tool, tool_call_id }`, `ToolPostContext` (`#[non_exhaustive]`: + `result_hash`, `is_error`, `duration`, `display_hint`).
- Compaction/detection: `CompactedContext { tokens_before/after/saved }`, `LoopDetectedContext { pattern, repetitions }`, `ConvergenceDetectedContext { action }`.

**Behavior notes**

- Pair tool pre/post by `tool_call_id`, never arrival order or `(turn, tool)`.
- `total_turns` at run end counts only finished turns.
- `CompactedContext.tokens_before` is reconstructed (after + saved) and excludes transients.

Deep dive: [Observers](../04-extensions/01-observers.md).
