---
title: "`src/provider/anthropic.rs` — `AnthropicClient` [feature: anthropic]"
---


The Messages API client — shared by the Z.ai profile and Bedrock's native path. (~3,640 lines with tests.)

**Key items**

- `from_env()` + builder including `with_max_tokens` (default 8192, **0 rejected at build**); headers `x-api-key` + `anthropic-version: 2023-06-01`.
- `RequestBodySpec` + `build_request_body` — system always a top-level field (folded from inline system messages, `""` when empty); tool_use/tool_result blocks; `is_error: true` travels on the wire.
- The shared `StreamEmitter` (reused by Bedrock): typed SSE events; usage latched at `message_start`, max-merged at `message_delta`; thinking/redacted-thinking lanes; `message_stop` is the terminal event.
- Forced-tool `response_format` synthesis + the two up-front rejections (strict formats, grammar constraints).
- `pub(super) DEFAULT_MAX_TOKENS` — shared with Bedrock.

**Behavior notes**

- Tool-input deltas carry no index — the emitter remembers the open block from `content_block_start`.
- `signature_delta` ignored; late events after `message_stop` swallowed (desync guard); a late error after a clean stop is dropped.
- Non-streaming replies skip thinking blocks entirely (reasoning is stream-only); images dropped.

Deep dive: [Anthropic](/providers/anthropic/).
