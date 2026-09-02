---
title: "`src/engine/bare/emission.rs` — the notification hub"
---


Every observer callback and hook notification in the engine is fired from here. The driver's business modules never fan out directly — one place to audit the full event surface.

**Key items**

- Observer fan-out: run start/end, turn start/end, response, tool call received/pre/post, stream success/failure, fallback, model switched, compaction, detected patterns, text/thinking deltas (delta dispatch also invokes the `text_streamer`).
- Hook fan-out [hooks]: run start/end, pre/post tool use (block/ask → soft results), pre/post compact (veto + merged guidance).
- `record_turn_success` / `record_turn_failure(_inner)` — the fallback bookkeeping (trip detection, `on_fallback`, chain advance via `mark_fallback_failed`, `on_stream_failure` always except cancel; poison supersedes the original error).
- Turn accounting helpers (`TurnAccounting`) for the tool-phase `on_turn_end` (provider token pair repeated — dispatch spends no model tokens).

**Behavior notes**

- `on_turn_end` fires twice for a tool-carrying turn (LLM phase + tool phase, disjoint durations); soft tool errors do **not** flip `success`.
- `on_tool_call_received` fires for pre-answered unknown-tool calls too — their only event.
- `on_model_switched` fires from `note_routed_model` on every routing change (trip, chain advance, recovery), deduplicated against the last routed model.

Deep dive: [Observers](/extensions/observers/).
