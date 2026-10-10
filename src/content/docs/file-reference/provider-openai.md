---
title: "`src/provider/openai.rs` — `OpenAiClient` [feature: openai]"
---


The Chat Completions client — base of the whole compatible family. (~3,950 lines with tests.)

**Key items**

- `from_env()` (OPENAI_API_KEY / BASE_URL / MODEL → gpt-4o) + the full builder (`with_stream_usage` true default; `replay_reasoning` true default 0.4.0 — prior thinking blocks return on continuation requests).
- Full `RequestOptions` support: `response_format` → native `json_schema` (tools suppressed); `ToolConstraint::Strict` → tightened schemas + `strict: true`; `Grammar` → `guided_json`.
- **`model_context_window()` (0.4.0)** — the one shipped client that discloses: llama.cpp `/props` (`n_ctx / total_slots`) and Ollama `/api/show` (architecture-keyed `context_length`); server-root probes under a 5-second deadline, cached per model epoch, `set_model` clears the cache, fail-soft `None`.
- The `StreamEmitter` — lane bookkeeping for interleaved text/thinking/tool content (text lane index 0, thinking 1); deferred `MessageDelta` until the usage chunk; `[DONE]` sentinel handling; **no synthetic MessageStop on failure**.
- Mid-stream error classification: `rate_limit_error` / 429 / 503 / 529 / `rate_limit_exceeded` → `ApiError::RateLimit`.

**Behavior notes**

- Tool-call arguments stream as string fragments; the lane-closing discipline keeps them out of the text slot (the subtle bug this prevents: tools executing with `{}` because their JSON landed in the wrong lane — pinned by tests).
- Tool results: `is_error` not forwarded (no wire field); N results → N `tool` messages + trailing user text; images dropped.
- Usage: `prompt_tokens_details.cached_tokens` fills `Usage::cached_input_tokens` (leniently — a non-numeric placeholder reads as zero without dropping the usage object).
- `set_model("")` rejected (false); base-URL setter trims trailing slashes.
- Non-streaming: non-JSON tool arguments are an `ApiError` (not silently `{}`); all-zero usage collapses to `None`.

Deep dive: [OpenAI](/providers/openai/).
