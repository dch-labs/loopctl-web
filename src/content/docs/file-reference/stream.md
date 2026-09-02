---
title: "`src/stream.rs` — stream events and the accumulator"
---


The neutral event vocabulary every provider speaks, and the folding machine that turns events into a finished message.

**Key items**

- `StreamEvent` — `MessageStart`, `PartStart { index, part }`, `IndexedDelta { index, delta }`, `PartStop { index }`, `MessageDelta { stop_reason, usage }`, `MessageStop`, `Ping`.
- `DeltaPart` — `Text`, `InputJson` (tool-argument fragments), `ToolCall` (legacy), `Thinking` (stream-only; empty = redacted reasoning).
- `StreamAccumulator` — `process(event)`, `build() -> Message`, `usage()`, `peek_parts()`.
- `StreamStopReason` — `ToolCall`, `MaxTokens`, `StopSequence`, `EndTurn`; `from_api_str` maps provider spellings; `should_continue_tool_loop()` is true only for `ToolCall`.
- `Usage { input_tokens, output_tokens }` + `total_tokens()`.
- `StreamError::InvalidToolInputJson` — the accumulator's only error.

**Behavior notes**

- The lifecycle order is a contract: `MessageStart → (PartStart → deltas → PartStop)* → MessageDelta → MessageStop`. Never a synthetic `MessageStop` on failure — its absence *is* the truncation signal.
- Routing is by the (index, lane-kind) pair — indices are reused across text/thinking/tool lanes on some wires.
- Empty tool input becomes `{}`; still-open lanes at `build()` are dropped; thinking flushes nothing.

Deep dive: [Stream events](/core-data/stream-events/).
