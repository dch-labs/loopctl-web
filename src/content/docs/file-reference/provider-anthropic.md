---
title: "src/provider/anthropic.rs"
---

This file holds `AnthropicClient`, the Messages API client behind the `anthropic` feature, and it is shared by the Z.ai profile and Bedrock's native path.

It runs to about 3,640 lines with tests.

## Key items

`from_env()` and the builder give you a client. `with_max_tokens` defaults to 8192 and rejects 0 at build time, `replay_reasoning` defaults to true since 0.4.0, and `prompt_caching(bool)` arrived in 0.4.0 and is off by default.

With prompt caching you get up to four `cache_control` breakpoints per request: the last tool definition, the system prompt, and the last two eligible tail blocks. Thinking blocks are skipped as breakpoints.

Your headers are `x-api-key` plus `anthropic-version: 2023-06-01`.

`RequestBodySpec` and `build_request_body` keep system always a top-level field, folded from inline system messages, with `""` when empty, and a marked text block when you enable `prompt_caching`.

Tool use and tool result blocks ride along, and `is_error: true` travels on the wire.

The shared `StreamEmitter`, which Bedrock also reuses, gives you typed SSE events. Usage is latched at `message_start` and max-merged at `message_delta`.

Since 0.4.0 the input total is normalized to raw plus cache reads plus creation, and `cache_read_input_tokens` fills `Usage::cached_input_tokens`.

Thinking and redacted-thinking lanes exist on their own indexes, and signatures latch since 0.4.0, meaning `signature` and the redacted payload ride `MessagePart::Thinking` for your continuation replay. `message_stop` is the terminal event.

Forced-tool `response_format` synthesis lives here, along with the two up-front rejections for strict formats and grammar constraints.

`pub(super) DEFAULT_MAX_TOKENS` is shared with Bedrock.

## Behavior notes

Tool-input deltas carry no index, so the emitter remembers the open block from `content_block_start`.

Late events after `message_stop` are swallowed as a desync guard, and a late error after a clean stop is dropped.

Since 0.4.0 your prior-turn thinking rides the request verbatim through `replay_reasoning`, and non-streaming replies carry their thinking blocks too, so the old strip-on-boundary behavior is gone.

Images are dropped by the converter.

For the deep dive, see [Anthropic](/providers/anthropic/).
