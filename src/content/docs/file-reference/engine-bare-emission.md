---
title: "src/engine/bare/emission.rs"
---

This file is the notification hub. Every observer callback and hook notification in the engine is fired from here.

Your driver's business modules never fan out directly, which leaves you one place to audit the full event surface.

## Key items

Observer fan-out covers run start and end, turn start and end, response, and tool call received, pre, and post.

It also covers stream success and failure, fallback, model switched, compaction, detected patterns, and the pre/post text and thinking deltas. Your delta dispatch also invokes the `text_streamer`.

Hook fan-out, behind the `hooks` feature, covers your run start and end. It adds pre and post tool use, where block and ask become soft results.

It also covers pre and post compact, which is where you get veto plus merged guidance.

`record_turn_success` and `record_turn_failure` with its `_inner` variant hold your fallback bookkeeping: trip detection, `on_fallback`, and chain advance via `mark_fallback_failed`.

`on_stream_failure` always fires except on cancel, and a poison supersedes the original error for you.

`TurnAccounting` helpers drive the tool-phase `on_turn_end`, where the provider token pair is repeated because dispatch spends no model tokens.

## Behavior notes

`on_turn_end` fires twice for a tool-carrying turn, once for the LLM phase and once for the tool phase, with disjoint durations. Soft tool errors do not flip `success` on you.

`on_tool_call_received` fires for pre-answered unknown-tool calls too, and that is their only event.

`on_model_switched` fires from `note_routed_model` on every routing change, meaning trip, chain advance, or recovery, deduplicated against the last routed model.

For the deep dive, see [Observers](/extensions/observers/).
