---
title: "OpenAI client"
sidebar:
  order: 2
---

`OpenAiClient` speaks the OpenAI Chat Completions protocol, and half the ecosystem speaks it too. That makes this one client the base for Ollama, DeepSeek, Grok/xAI, Azure OpenAI, Moonshot, and any self-hosted server you point it at. The source is `src/provider/openai.rs`.

## Construction

```rust
// From environment (OPENAI_API_KEY, optional OPENAI_BASE_URL, OPENAI_MODEL):
let client = OpenAiClient::from_env()?;

// Or explicit:
let client = OpenAiClient::builder()
    .with_api_key(key)
    .with_model("gpt-4o")                  // default: "gpt-4o"
    .with_base_url("https://api.openai.com/v1")   // the default
    .with_stream_usage(true)               // default: ask for usage in streams
    .build()?;
```

When you set `stream_usage(true)`, your requests add `stream_options` with `include_usage: true`, so your streamed turns report token counts.

Those counts arrive as a final usage chunk after the stop reason, and the client handles the ordering for you.

## The compatible profiles

Each profile is one call:

| Profile | Env vars | Base URL | Default model |
|---|---|---|---|
| `provider::ollama("model")` | `OLLAMA_BASE_URL` optional, `OLLAMA_API_KEY` optional | `http://localhost:11434/v1` | Your argument |
| `provider::deepseek()` | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` optional | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `provider::grok()` | `XAI_API_KEY` or `GROK_API_KEY`, `XAI_MODEL` or `GROK_MODEL` optional | `https://api.x.ai/v1` | `grok-beta` |
| `provider::azure("resource")` | `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_MODEL`, both required | `https://{resource}.openai.azure.com/openai/v1` | The deployment name |
| `provider::moonshot()` | `MOONSHOT_API_KEY`, `MOONSHOT_MODEL` optional | `https://api.moonshot.ai/v1` | `kimi-k3` |
| `provider::self_hosted(url, model)` | `OPENAI_API_KEY`, optional for local | Yours | Yours |

Three details matter when you pick one:

- **Ollama** sets `stream_usage(false)`, because older Ollama builds reject the `include_usage` option. Consequence: streamed turns report `usage: None`, and non-streamed turns still report it.

- **Azure** validates your resource name before it touches env vars, which means 2 to 64 characters of letters, digits, and hyphens. It also requires the deployment name as the model, because that is how Azure routes. Only the modern v1 API surface is supported.

- **Grok** prefers the `XAI_*` spellings over `GROK_*` when both exist in your environment.

## Wire behavior

- Your endpoint is `{base_url}/chat/completions`, and authentication is `Authorization: Bearer <key>`.
- Your system prompt becomes the first `system`-role message, and inline system messages pass through natively.
- Tool calls stream in as `tool_calls[].function.arguments` fragments, which is a JSON string built up piece by piece. The client maps them to `InputJson` deltas under a per-index lane.

The lane bookkeeping is what keeps that safe. Text and tool lanes can interleave, so the emitter closes lanes with addressed stops and your fragments never land in the wrong slot.

Thinking routes to a separate lane too. Models that emit `reasoning_content`, such as DeepSeek-R1 and the o-series style models, produce `on_thinking_delta` fragments (0.4.0).

The assembled `MessagePart::Thinking` also rides the conversation for continuation replay when you leave `replay_reasoning(true)` on the builder, which is the default.

Finish reasons map directly:

- `tool_calls` becomes ToolCall.
- `length` becomes MaxTokens.
- `stop` becomes EndTurn.

For usage, `prompt_tokens_details.cached_tokens` fills `Usage::cached_input_tokens`. That object and field are both defaulted, so a non-numeric placeholder from an OpenAI-compatible server reads as zero instead of dropping your whole usage object.

A stream ends on the `data: [DONE]` sentinel. A stream that ends without it, or without a finish reason, is reported as truncated rather than as a clean stop.

### The context-window probe

This is the one shipped client that answers `model_context_window()`, and it does so for the two server families that disclose the number:

- **llama.cpp `/props`** reads `default_generation_settings.n_ctx` divided by `total_slots`. A `--parallel` server splits its KV budget, so the per-slot allocation is what your single request must fit.
- **Ollama `/api/show`** is a POST carrying your model name, and the `context_length` key is matched by suffix. Real Ollama keys it by architecture, as in `llama.context_length`.

Both probes hit the server root, with one trailing `/v1`-style segment stripped from your base URL. They reuse the client's pooled HTTP layer under their own 5 second total deadline, and they cache per model. If you call `set_model`, the cache clears so your swapped model re-probes.

Failures are fail-soft. A timeout, an HTTP error, or garbage yields `None`, so your declared window stands. When both exist, your engine resolves probe over declaration at run start, which [context accounting](/engine/context-accounting/) covers.

### Structured output on this client

`RequestOptions` is fully supported here:

- **`response_format`** maps to native `json_schema` mode, and your caller tools are suppressed for that request because the format replaces them.
- **`ToolConstraint::Strict`** tightens every tool schema, which closes all objects and requires all properties, and sets `strict: true`. That is the exact shape OpenAI strict mode demands.
- **`ToolConstraint::Grammar(provider)`** puts `guided_json` in the body for vLLM-style servers, under the `grammar` feature. Plain OpenAI ignores or rejects it, so use it only with servers that understand it.

### Mid-stream errors

An SSE error object is classified rather than swallowed. The rate-limit family, meaning `rate_limit_error` and codes 429, 503, and 529, becomes `ApiError::RateLimit` so your retry ladder owns it. Anything else becomes `ApiError::api`, and the stream terminates with that error rather than faking completion.

## Gotchas

1. `is_error` on tool results is not forwarded, because Chat Completions has no error flag. The error text is conveyed as the tool message's content, so your model still reads what happened, only without the formal flag.

2. Images are dropped by the converter, because the neutral types carry them and this wire does not.

3. Multiple tool results in one loopctl message expand into the several `tool` messages that OpenAI expects, with any accompanying text as a trailing user message. That is handled for you.

4. `set_model("")` returns false rather than blanking your model. That rejection is the same on all clients.

## Related pages

- [Overview](/providers/overview/) is the full matrix.
- [Structured output](/integration/structured-output/) shows the options in action.
