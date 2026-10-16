---
title: "Providers"
sidebar:
  order: 1
---

loopctl ships ready-made clients for the major providers plus every OpenAI-compatible service. This page is the map, and the following pages cover each client's specifics. Sources are `src/provider.rs` and `src/provider/*.rs`.

## The feature matrix

Enable one Cargo feature per provider. Each feature turns on what your client needs, all of them imply `providers`, and the HTTP ones imply `streaming`.

| Feature | Client | Protocol |
|---|---|---|
| `openai` | `OpenAiClient` | OpenAI Chat Completions |
| `anthropic` | `AnthropicClient` | Anthropic Messages |
| `gemini` | `GeminiClient` | Google Gemini |
| `bedrock` | `BedrockClient` | AWS Bedrock, two paths |
| `ollama` | A profile over `OpenAiClient` | OpenAI-compatible, local or cloud |
| `deepseek` | A profile over `OpenAiClient` | OpenAI-compatible |
| `grok` or `xai` | A profile over `OpenAiClient` | OpenAI-compatible on xAI |
| `azure` | A profile over `OpenAiClient` | Azure OpenAI v1 |
| `moonshot` | A profile over `OpenAiClient` | OpenAI-compatible on Kimi |
| `zai` | A profile over `AnthropicClient` | Anthropic-compatible on GLM |

Beyond providers, features also cover whole subsystems. The full table with dependencies lives in the crate README, and the names are:

- `builtin_tools` for Think and Read.
- `fs_tools` for Write, Edit, MultiEdit, and FileViewer.
- `search_tools` for Glob, Grep, CodeSearch, and Tree.
- `shell_tools` for Shell and Jobs.
- `vector_index` and `vector_memory` for semantic memory.
- `file_memory` for the JSONL store.
- `file_grants` for your persisted approvals.
- `manifest` for your loop.yaml model.
- `mcp`, `redaction`, `tool_health`, `tool_shield`, `hooks`, `testing`, and `derive`.

Two provider features grow an extra surface when you also enable `vector_index`. `openai` gains `OpenAiEmbedder` and `ollama` gains `OllamaEmbedder`, covered in [embeddings](/providers/embeddings/).

Each profile gives you one function and adds zero new wire code. It carries the right base URL, env vars, and defaults for you:

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

Every client also has a builder, such as `OpenAiClient::builder().with_api_key(..).with_model(..)....build()?`. The same knobs appear everywhere:

- API key, base URL, and model.
- Timeout, where your read timeout defaults to 120s and your connect timeout to 10s.
- Connection-pool tuning.
- An injectable `reqwest::Client` when you want full HTTP control.

Base-URL setters trim trailing slashes, so `…/v1/` and `…/v1` are the same thing to your client.

## Profile builders: the middle tier

Between the one-line constructors and the bare client builders sits a middle tier added in 0.3.1: the profile builders. There is `deepseek_builder()`, `grok_builder()`, `moonshot_builder()`, `ollama_builder(model)`, and `azure_builder(resource)`, each returning an `OpenAiClientBuilder`, plus `zai_builder()`, which returns an `AnthropicClientBuilder`.

Each one returns the underlying client builder with the provider's facts pre-seeded. That means the endpoint, the credential environment variable with its alias fallbacks preserved, and the default model.

```rust
let client = loopctl::provider::ollama_builder("qwen3:14b")   // endpoint + local defaults seeded
    .with_base_url("http://gpu-box:11434")                    // your config wins
    .build()?;
```

This is the tier built for config-file-driven hosts. You apply your own precedence on top, because `with_api_key`, `with_model`, `with_base_url`, and `with_timeout` all override the seed.

A bad seeded fact fails at `build()`. Think an invalid Azure resource name, a missing key, or Azure's missing deployment model. Failures arrive in the same order the constructors have always reported, and each one names the environment variable, such as `MOONSHOT_API_KEY` or `AZURE_OPENAI_MODEL`.

Two consequences are worth having. You never need to duplicate a provider fact outside the crate, and the zero-argument constructors are now thin wrappers over these builders, so they behave identically, error messages included. `BedrockClientBuilder` gained the same shared HTTP knobs as the rest.

## What every client gives you

- **Both turn modes.** You get streaming through `stream_messages` and non-streaming through `create_message`.

- **Full `RequestOptions` support.** Per-request model override, JSON-schema response formats, strict tool constraints, and thinking effort. Bedrock is the exception, because it implements the base methods only.

- **Hot model swap.** `set_model` works on all shipped clients, which enables [`switch_model`](/engine/model-switch/).

- **Neutral types.** Every provider's quirks are translated into the same `Message` and `StreamEvent` vocabulary, so your engine is blind to which provider is serving.

- **Honest failure classification.** HTTP 429, 503, and 529 plus their SSE-shaped cousins become `ApiError::RateLimit` with a parsed `Retry-After`. Auth failures fail fast, and a stream cut without its terminal event is reported as truncation rather than as a clean stop.

- **Window disclosure where it exists (0.4.0).** The OpenAI-compatible client answers `model_context_window()` from llama.cpp `/props` and Ollama `/api/show`. Everything else reports `None` and your declared window stands, covered in [context accounting](/engine/context-accounting/).

- **Cached-token accounting.** Every shipped provider fills `Usage::cached_input_tokens` from its native cache report, so you can see cached tokens in your usage totals.

## Provider conventions worth knowing once

| Topic | Behavior |
|---|---|
| System prompts | OpenAI takes inline system messages, and that is fine. Anthropic and Gemini reject inline ones mid-conversation, so loopctl folds system messages into the provider's native top-level field. |
| Tool results | Translated to each provider's shape. Anthropic carries `is_error` flags, Converse uses a status field, and OpenAI plus Gemini convey errors as text. |
| Images | The data model carries them, and all shipped converters currently drop image parts when building requests. |
| Empty tool lists | Never sent, because every provider rejects or misreads an empty `tools` array. The field is omitted instead. |
| Usage reporting | All-zero usage collapses to `None`. Providers report usage at different stream points, and each client latches it correctly for its wire format. |
| Reply size limits | Response bodies are capped at 10 MB, error bodies at 8 KB, and single SSE lines at 1 MB. A hostile or broken server cannot balloon your memory. |

## Per-provider pages

- [OpenAI and the compatible family](/providers/openai/) covers `OpenAiClient`, Ollama, DeepSeek, Grok, Azure, Moonshot, and self-hosted.
- [Anthropic](/providers/anthropic/) covers Claude, thinking blocks, forced-tool JSON, and prompt caching.
- [Gemini](/providers/gemini/) covers the Gemini quirks of model-in-URL and thoughts.
- [Bedrock](/providers/bedrock/) covers AWS signing, event-stream decoding, and Converse.
- [SSE under the hood](/providers/sse/) covers how streaming bytes become events.
- [Grammar constraints](/providers/grammar/) covers vLLM `guided_json` for local models.
- [Embeddings](/providers/embeddings/) covers the `EmbeddingProvider` backends for semantic memory.

## Picking for local development

`provider::ollama("qwen3")` against a local Ollama server is the cheapest way to develop against a real model. You get no cloud key, no cost, and full tool-calling.

For the no-model-at-all tier, use the `testing` feature's `MockApiClient`, covered in [testing](/integration/testing/).
