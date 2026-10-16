---
title: "Gemini client"
sidebar:
  order: 4
---

`GeminiClient` speaks the Google Gemini protocol, and the source is `src/provider/gemini.rs`.

It is a well-behaved client with three quirks worth knowing. The model lives in the URL, the API key never does, and thinking is a per-request opt-in.

## Construction

```rust
let client = GeminiClient::from_env()?;   // GEMINI_API_KEY or GOOGLE_API_KEY,
                                          // optional GEMINI_BASE_URL / GEMINI_MODEL

let client = GeminiClient::builder()
    .with_api_key(key)
    .with_model("gemini-2.0-flash")       // the default
    .with_include_thoughts(true)          // default false — see below
    .build()?;
```

### Quirk 1: the model lives in the URL

Your requests go to `{base}/models/{model}:streamGenerateContent?alt=sse`, or to `:generateContent` for a non-streaming call.

A per-request model override through `RequestOptions::with_model` therefore changes the URL for that request. The client builds it correctly, and that is why your override behaves differently than on a body-model provider.

### Quirk 2: the key never travels in the URL

Your key travels in a header, `x-goog-api-key`, and never as a `?key=` query parameter, which a test pins, because keys in URLs leak into logs.

### Quirk 3: thinking is opt-in per client

Reasoning models need `thinkingConfig.includeThoughts = true` on the request, and non-reasoning models reject that field with a 400.

So set `with_include_thoughts(true)` when your model supports thoughts. Its `thought: true` parts then stream to `on_thinking_delta`, and its thought tokens are counted in your output usage. Leave the flag off otherwise.

The response parser routes thought parts correctly either way.

## What this client translates for you

- **System prompts.** Gemini rejects inline `system` roles, so they are folded into the top-level `systemInstruction` field, which is omitted entirely when empty.
- **Tool calls.** These become `functionCall` parts, and your results become `functionResponse` parts carrying both name and id. Gemini correlates by function name, which is why your tool results always carry the name. `is_error` has no wire form here, so error text conveys it.
- **Usage.** `promptTokenCount` becomes your input, and `candidatesTokenCount + thoughtsTokenCount` becomes your output.
- **Finish reasons.** `MAX_TOKENS` becomes MaxTokens, and everything else, including STOP and SAFETY, becomes EndTurn.

## Structured output

Three behaviors match the pattern you saw on the other clients:

- **`response_format`** maps to `generationConfig.responseMimeType` set to `application/json` plus `responseJsonSchema`. A `strict: true` is rejected up front, rather than running silently non-strict, because the API has no strict switch.
- **`ToolConstraint::Grammar`** is rejected, because there is no grammar-constrained decoding.
- **`ToolConstraint::Strict`** is supported through schema tightening, same as the others.

## Streaming specifics

Gemini streams JSON chunks over SSE without a `[DONE]` sentinel. Your terminal signal is a chunk carrying `finishReason`, and only that completes the turn, so a stream without it is truncation.

Proxies sometimes split the finish reason and the usage into separate final chunks. The client latches the latest non-empty `usageMetadata` and emits stop plus usage together.

Tool calls arrive as complete `functionCall` parts. The client emits them as open-fill-close sequences, meaning part start, one JSON delta, then part stop, so your downstream consumers see the same shape as on other providers.

Errors embedded in chunks classify by code or status. Codes 429, 503, and 529 plus `RESOURCE_EXHAUSTED` and `UNAVAILABLE` become rate limits, and anything else becomes a plain API error.

## Gotchas

1. Images are dropped by the converter, same as the other shipped clients.

2. A non-reasoning model with `include_thoughts(true)` gives you a 400 `INVALID_ARGUMENT`, so match the flag to the model.

3. Streaming usage from Gemini proxies can be partial. The client latches whatever arrives, so your `usage` may be `None` behind a quirky proxy.

4. An empty `functionCall.args` normalizes to `{}`, and a malformed args value passes through verbatim so you see it rather than having it hidden.

## Related pages

- [Overview](/providers/overview/) is the provider map.
- [Structured output](/integration/structured-output/) covers the constraint modes.
