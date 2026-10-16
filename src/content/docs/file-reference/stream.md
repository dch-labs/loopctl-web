---
title: "src/stream.rs"
---

This file holds the neutral event vocabulary every provider speaks, plus the folding machine that turns those events into a message you can read.

Learn this vocabulary once and you can debug any provider's stream.

## Key items

`StreamEvent` covers `MessageStart`, `PartStart { index, part }`, `IndexedDelta { index, delta }`, `PartStop { index }`, `MessageDelta { stop_reason, usage }`, `MessageStop`, and `Ping`.

`DeltaPart` covers `Text`, `InputJson` for tool-argument fragments, and `ToolCall` which is legacy.

`Thinking { text, signature, redacted }` arrived in 0.4.0, where signatures and redacted payloads latch. A closed thinking lane flushes a `MessagePart::Thinking` into your assembled message, and empty text with a redacted payload means withheld reasoning.

`StreamAccumulator` gives you `process(event)`, `build() -> Message`, `usage()`, and `peek_parts()`.

`StreamStopReason` covers `ToolCall`, `MaxTokens`, `StopSequence`, and `EndTurn`. `from_api_str` maps provider spellings, and `should_continue_tool_loop()` is true only for `ToolCall`.

`Usage { input_tokens, output_tokens, cached_input_tokens }` adds `total_tokens()`, where the cached share is a subset of input, and `with_cached_input(n)` attaches it as of 0.4.0.

`StreamError::InvalidToolInputJson` is your accumulator's only error.

## Behavior notes

Treat the lifecycle order as a contract: `MessageStart → (PartStart → deltas → PartStop)* → MessageDelta → MessageStop`.

Expect never a synthetic `MessageStop` on failure, because its absence is the truncation signal.

Routing keys on the index and lane-kind pair, since indices are reused across text, thinking, and tool lanes on some wires.

Empty tool input becomes `{}`. Lanes still open at `build()` are dropped, so a thinking lane you never closed flushes nothing.

Deep dive: [Stream events](/core-data/stream-events/).
