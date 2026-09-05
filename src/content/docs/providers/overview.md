---
title: "Providers — talking to real models"
sidebar:
  order: 1
---


loopctl ships ready-made clients for the major providers plus every OpenAI-compatible service. This page is the map; the following pages cover each client's specifics. Source: `src/provider.rs` and `src/provider/*.rs`.

---

## The feature matrix

Enable Cargo features per provider; each feature turns on what it needs (all of them imply `providers`, and the HTTP ones imply `streaming`):

| Feature | Client | Protocol |
|---|---|---|
| `openai` | `OpenAiClient` | OpenAI Chat Completions |
| `anthropic` | `AnthropicClient` | Anthropic Messages |
| `gemini` | `GeminiClient` | Google Gemini |
| `bedrock` | `BedrockClient` | AWS Bedrock (two paths) |
| `ollama` | profile over `OpenAiClient` | OpenAI-compatible (local or cloud) |
| `deepseek` | profile over `OpenAiClient` | OpenAI-compatible |
| `grok` / `xai` | profile over `OpenAiClient` | OpenAI-compatible (xAI) |
| `azure` | profile over `OpenAiClient` | Azure OpenAI v1 |
| `moonshot` | profile over `OpenAiClient` | OpenAI-compatible (Kimi) |
| `zai` | profile over `AnthropicClient` | Anthropic-compatible (GLM) |

One function per profile — zero new wire code, just the right base URL, env vars, and defaults:

```rust
// Each reads its own env vars; each has sensible defaults:
let client = provider::deepseek()?;             // DEEPSEEK_API_KEY → deepseek-chat
let client = provider::ollama("llama3")?;       // http://localhost:11434/v1
let client = provider::grok()?;                 // XAI_API_KEY → grok-beta
let client = provider::azure("my-resource")?;   // AZURE_OPENAI_API_KEY + deployment name
let client = provider::moonshot()?;             // MOONSHOT_API_KEY → kimi-k3
let client = provider::zai()?;                  // ZAI_API_KEY → glm-4.7 (Anthropic wire)
let client = provider::self_hosted(url, model)?; // any OpenAI-compatible server
```

## The direct constructors

```rust
OpenAiClient::from_env()      // OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL (→ gpt-4o)
AnthropicClient::from_env()   // ANTHROPIC_API_KEY / _BASE_URL / _MODEL (→ claude-sonnet-4)
GeminiClient::from_env()      // GEMINI_API_KEY or GOOGLE_API_KEY (→ gemini-2.0-flash)
BedrockClient::from_env()     // AWS_REGION + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY
```

Every client also has a builder (`OpenAiClient::builder().with_api_key(..).with_model(..)....build()?`) with the same knobs everywhere: api key, base URL, model, timeout (default 120s read timeout), connect timeout (10s), connection-pool tuning, and an injectable `reqwest::Client` for full HTTP control. Base-URL setters trim trailing slashes (`…/v1/` == `…/v1`).

## Profile builders — the middle tier

Between the one-line constructors and the bare client builders sits a middle tier added in 0.3.1: **profile builders** — `deepseek_builder()`, `grok_builder()`, `moonshot_builder()`, `ollama_builder(model)`, `azure_builder(resource)` (each returning an `OpenAiClientBuilder`), and `zai_builder()` (returning an `AnthropicClientBuilder`). Each returns the underlying client builder with the provider's *facts* pre-seeded — the endpoint, the credential environment variable (alias fallbacks preserved), and the default model:

```rust
let client = loopctl::provider::ollama_builder("qwen3:14b")   // endpoint + local defaults seeded
    .with_base_url("http://gpu-box:11434")                    // your config wins
    .build()?;
```

This is the tier for **config-file-driven hosts**: apply your own precedence on top (`with_api_key` / `with_model` / `with_base_url` / `with_timeout` override the seed), and a bad seeded fact — an invalid Azure resource name, a missing key, Azure's missing deployment model — fails at `build()`, in the same order the constructors have always reported, naming the environment variable (`MOONSHOT_API_KEY`, `AZURE_OPENAI_MODEL`, …). No provider fact needs to be duplicated outside the crate. The zero-argument constructors are now thin wrappers over these builders and behave identically, error messages included; `BedrockClientBuilder` gained the same shared HTTP knobs as the rest.

---

## What every client gives you

## What every client gives you

- **Both turn modes** — streaming (`stream_messages`) and non-streaming (`create_message`).
- **Full `RequestOptions` support** — per-request model override, JSON-schema response formats, strict tool constraints. (Bedrock is the exception: it implements the base methods only.)
- **Hot model swap** — `set_model` works on all shipped clients, enabling [`switch_model`](/engine/model-switch/).
- **Neutral types** — every provider's quirks are translated into the same `Message`/`StreamEvent` vocabulary; the engine is blind to which provider is serving.
- **Honest failure classification** — HTTP 429/503/529 and their SSE-shaped cousins become `ApiError::RateLimit` with parsed `Retry-After`; auth failures fail fast; a stream cut without its terminal event is reported as truncation, never as a clean stop.

## Provider conventions worth knowing once

| Topic | Behavior |
|---|---|
| **System prompts** | OpenAI: inline system messages, fine. Anthropic/Gemini: loopctl *folds* system messages into the provider's native top-level field (they reject inline ones mid-conversation). |
| **Tool results** | Translated to each provider's shape; Anthropic carries `is_error` flags, Converse uses a status field, OpenAI/Gemini convey errors as text. |
| **Images** | The data model carries them; **all shipped converters currently drop image parts** when building requests. |
| **Empty tool lists** | Never sent — every provider rejects or misreads an empty `tools` array; the field is omitted instead. |
| **Usage reporting** | All-zero usage collapses to `None`. Providers report usage at different stream points; each client latches it correctly for its wire format. |
| **Reply size limits** | Response bodies capped at 10 MB; error bodies at 8 KB; single SSE lines at 1 MB — a hostile or broken server cannot balloon memory. |

## Per-provider pages

- [OpenAI & the compatible family](/providers/openai/) — OpenAiClient, Ollama, DeepSeek, Grok, Azure, Moonshot, self-hosted.
- [Anthropic](/providers/anthropic/) — Claude, thinking blocks, forced-tool JSON.
- [Gemini](/providers/gemini/) — Gemini quirks: model-in-URL, thoughts.
- [Bedrock](/providers/bedrock/) — AWS signing, event-stream decoding, Converse.
- [SSE under the hood](/providers/sse/) — how streaming bytes become events.
- [Grammar constraints](/providers/grammar/) — vLLM `guided_json` for local models.

## Picking for local development

`provider::ollama("qwen3")` against a local Ollama server is the cheapest way to develop against a *real* model — no cloud key, no cost, and full tool-calling. The `testing` feature's `MockApiClient` covers the no-model-at-all tier. See [testing](/integration/testing/).
