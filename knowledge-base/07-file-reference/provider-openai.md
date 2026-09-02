# `src/provider/openai.rs` — `OpenAiClient` [feature: openai]

The Chat Completions client — base of the whole compatible family. (~3,950 lines with tests.)

**Key items**

- `from_env()` (OPENAI_API_KEY / BASE_URL / MODEL → gpt-4o) + the full builder (`with_stream_usage` true default).
- Full `RequestOptions` support: `response_format` → native `json_schema` (tools suppressed); `ToolConstraint::Strict` → tightened schemas + `strict: true`; `Grammar` → `guided_json`.
- The `StreamEmitter` — lane bookkeeping for interleaved text/thinking/tool content (text lane index 0, thinking 1); deferred `MessageDelta` until the usage chunk; `[DONE]` sentinel handling; **no synthetic MessageStop on failure**.
- Mid-stream error classification: `rate_limit_error` / 429 / 503 / 529 / `rate_limit_exceeded` → `ApiError::RateLimit`.

**Behavior notes**

- Tool-call arguments stream as string fragments; the lane-closing discipline keeps them out of the text slot (the subtle bug this prevents: tools executing with `{}` because their JSON landed in the wrong lane — pinned by tests).
- Tool results: `is_error` not forwarded (no wire field); N results → N `tool` messages + trailing user text; images dropped.
- `set_model("")` rejected (false); base-URL setter trims trailing slashes.
- Non-streaming: non-JSON tool arguments are an `ApiError` (not silently `{}`); all-zero usage collapses to `None`.

Deep dive: [OpenAI](../05-providers/02-openai.md).
