---
title: "src/provider/openai.rs"
---

This file holds `OpenAiClient`, the Chat Completions client, which is the base of the whole compatible family. It runs about 3,950 lines with tests.

## Key items

`from_env()` reads OPENAI_API_KEY, BASE_URL, and MODEL, defaulting to gpt-4o. The full builder gives you `with_stream_usage` and `replay_reasoning`, both defaulting to true.

Since 0.4.0 `replay_reasoning` returns prior thinking blocks on continuation requests, which keeps your reasoning visible across turns.

Full `RequestOptions` support covers three mappings. Your `response_format` becomes native `json_schema` with tools suppressed, `ToolConstraint::Strict` becomes tightened schemas plus `strict: true`, and `Grammar` becomes `guided_json`.

`model_context_window()` shipped in 0.4.0 and is the one client that discloses what it finds. It reads llama.cpp `/props` for `n_ctx / total_slots` and Ollama `/api/show` for the architecture-keyed `context_length`.

Both are server-root probes under a 5-second deadline, cached per model epoch, cleared when you call `set_model`, and fail-soft to `None`.

The `StreamEmitter` keeps lane bookkeeping for interleaved text, thinking, and tool content, with text at lane index 0 and thinking at 1.

It defers `MessageDelta` until the usage chunk, handles the `[DONE]` sentinel, and emits no synthetic MessageStop on failure.

Mid-stream error classification maps `rate_limit_error`, 429, 503, 529, and `rate_limit_exceeded` to `ApiError::RateLimit`.

## Behavior notes

Tool-call arguments stream as string fragments, and the lane-closing discipline keeps them out of the text slot.

That discipline prevents a subtle bug where tools executed with `{}` because their JSON landed in the wrong lane, and tests pin it.

For tool results, `is_error` is not forwarded, since there is no wire field for it. Your N results become N `tool` messages plus trailing user text, and images are dropped.

For usage, `prompt_tokens_details.cached_tokens` fills `Usage::cached_input_tokens`. This reads leniently, so a non-numeric placeholder reads as zero without dropping the usage object.

`set_model("")` is rejected and returns false, and your base-URL setter trims trailing slashes.

In non-streaming mode, non-JSON tool arguments are an `ApiError` rather than a silent `{}`, and all-zero usage collapses to `None`.

For the deep dive, see [OpenAI](/providers/openai/).
