# `src/provider/anthropic.rs` — `AnthropicClient` [feature: anthropic]

The Messages API client — shared by the Z.ai profile and Bedrock's native path. (~3,640 lines with tests.)

**Key items**

- `from_env()` + builder including `with_max_tokens` (default 8192, **0 rejected at build**), `replay_reasoning` (true default, 0.4.0), and `prompt_caching(bool)` (0.4.0, off by default — up to four `cache_control` breakpoints per request: last tool definition, system prompt, last two eligible tail blocks; thinking blocks skipped as breakpoints); headers `x-api-key` + `anthropic-version: 2023-06-01`.
- `RequestBodySpec` + `build_request_body` — system always a top-level field (folded from inline system messages, `""` when empty; a marked text block under `prompt_caching`); tool_use/tool_result blocks; `is_error: true` travels on the wire.
- The shared `StreamEmitter` (reused by Bedrock): typed SSE events; usage latched at `message_start`, max-merged at `message_delta` (input normalized to raw + cache reads + creation since 0.4.0, with `cache_read_input_tokens` filling `Usage::cached_input_tokens`); thinking/redacted-thinking lanes — **signatures latch since 0.4.0** (`signature` / the redacted payload ride `MessagePart::Thinking` for continuation replay); `message_stop` is the terminal event.
- Forced-tool `response_format` synthesis + the two up-front rejections (strict formats, grammar constraints).
- `pub(super) DEFAULT_MAX_TOKENS` — shared with Bedrock.

**Behavior notes**

- Tool-input deltas carry no index — the emitter remembers the open block from `content_block_start`.
- Late events after `message_stop` swallowed (desync guard); a late error after a clean stop is dropped.
- Since 0.4.0 prior-turn thinking rides the request verbatim (`replay_reasoning`) and non-streaming replies carry their thinking blocks too — the strip-on-boundary behavior is gone; images dropped by the converter.

Deep dive: [Anthropic](../05-providers/03-anthropic.md).
