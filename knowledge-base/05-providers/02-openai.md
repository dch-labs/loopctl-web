# OpenAI client — and its compatible family

`OpenAiClient` speaks the OpenAI Chat Completions protocol — and so does half the ecosystem, which makes this one client the base for Ollama, DeepSeek, Grok/xAI, Azure OpenAI, Moonshot, and any self-hosted server. Source: `src/provider/openai.rs`.

---

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

`stream_usage(true)` adds `stream_options: {include_usage: true}` so streamed turns report token counts (delivered as a final usage chunk after the stop reason — the client handles the ordering).

## The compatible profiles (one call each)

| Profile | Env vars | Base URL | Default model |
|---|---|---|---|
| `provider::ollama("model")` | `OLLAMA_BASE_URL` (opt), `OLLAMA_API_KEY` (opt) | `http://localhost:11434/v1` | your argument |
| `provider::deepseek()` | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (opt) | `https://api.deepseek.com/v1` | `deepseek-chat` |
| `provider::grok()` | `XAI_API_KEY` or `GROK_API_KEY`, `XAI_MODEL`/`GROK_MODEL` (opt) | `https://api.x.ai/v1` | `grok-beta` |
| `provider::azure("resource")` | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_MODEL` (**both required**) | `https://{resource}.openai.azure.com/openai/v1` | the deployment name |
| `provider::moonshot()` | `MOONSHOT_API_KEY`, `MOONSHOT_MODEL` (opt) | `https://api.moonshot.ai/v1` | `kimi-k3` |
| `provider::self_hosted(url, model)` | `OPENAI_API_KEY` (optional for local) | yours | yours |

Details that matter:

- **Ollama** sets `stream_usage(false)` — older Ollama builds reject the `include_usage` option. Consequence: streamed turns report `usage: None`; non-streamed turns still do.
- **Azure** validates the resource name (2–64 chars, letters/digits/hyphens) before touching env vars, and requires the **deployment name** as the model (that's how Azure routes). Only the modern v1 API surface is supported.
- **Grok** prefers the `XAI_*` spellings over `GROK_*` when both exist.

## Wire behavior

- Endpoint: `{base_url}/chat/completions`; auth as `Authorization: Bearer <key>`.
- System prompt → first `system`-role message; inline system messages pass through natively.
- Tool calls stream in as `tool_calls[].function.arguments` fragments (JSON string built up piece by piece); the client maps them to `InputJson` deltas under a per-index lane. The lane bookkeeping matters: text and tool lanes can interleave, and the emitter closes lanes with addressed stops so fragments never land in the wrong slot.
- Thinking (`reasoning_content`, as DeepSeek-R1 and o-series style models emit) routes to a separate thinking lane — visible via `on_thinking_delta`, never mixed into the text.
- Finish reasons map: `tool_calls` → ToolCall, `length` → MaxTokens, `stop` → EndTurn.
- The stream ends on the `data: [DONE]` sentinel; a stream that ends **without** it (or without a finish reason) is reported as truncated — never a clean stop.

### Structured output on this client

`RequestOptions` is fully supported:

- **`response_format`** → native `json_schema` mode; caller tools are suppressed for that request (the format replaces them).
- **`ToolConstraint::Strict`** → every tool schema is *tightened* (all objects closed, all properties required) and `strict: true` is set — the exact shape OpenAI strict mode demands.
- **`ToolConstraint::Grammar(provider)`** [feature: grammar] → `guided_json` in the body (for vLLM-style servers); plain OpenAI ignores or rejects it — use it with servers that understand it.

### Mid-stream errors

An SSE error object is classified: rate-limit family (`rate_limit_error`, codes 429/503/529) → `ApiError::RateLimit` so the retry ladder owns it; anything else → `ApiError::api` and the stream terminates with that error (no fake completion).

---

## Gotchas

1. **`is_error` on tool results is not forwarded** — Chat Completions has no error flag; error text is conveyed as the tool message's content. The model still reads what happened, just without the formal flag.
2. **Images are dropped** by the converter (the neutral types carry them; this wire doesn't).
3. **Multiple tool results in one loopctl message** expand into the several `tool` messages OpenAI expects, with any accompanying text as a trailing user message — handled for you.
4. **`set_model("")`** returns `false` (rejected) rather than blanking the model — same on all clients.

## Related pages

- [Overview](01-overview.md) — the full matrix.
- [Structured output](../06-integration/01-structured-output.md) — the options in action.
