---
title: "Gemini client — Google's model, its three quirks"
sidebar:
  order: 4
---


`GeminiClient` speaks the Google Gemini protocol. Source: `src/provider/gemini.rs`. It's a well-behaved client with three quirks worth knowing: the model lives in the URL, the API key never does, and "thinking" is a per-request opt-in.

---

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

**Quirk 1 — model in the URL.** Requests go to `{base}/models/{model}:streamGenerateContent?alt=sse` (or `:generateContent`). A per-request model override (`RequestOptions::with_model`) therefore changes the *URL* for that request — the client builds it correctly, but it's why the override works differently than in body-model providers.

**Quirk 2 — key in a header.** The key travels as `x-goog-api-key`, never as a `?key=` query parameter (pinned by a test — keys in URLs leak into logs). Also note `include_thoughts`:

**Quirk 3 — thinking is opt-in per client.** Reasoning models need `thinkingConfig.includeThoughts = true` on the request; non-reasoning models *reject* that field with a 400. So: `with_include_thoughts(true)` when your model supports thoughts (its `thought: true` parts then stream to `on_thinking_delta` and its thought tokens are counted in output usage); leave it off otherwise. The response parser routes thought parts correctly regardless of the flag.

## What this client translates for you

- **System prompts:** Gemini rejects inline `system` roles — folded into the top-level `systemInstruction` field (omitted entirely when empty).
- **Tool calls:** `functionCall` parts; your results become `functionResponse` parts carrying **both name and id** — Gemini correlates by function name, which is why loopctl's tool results always carry the name. `is_error` has no wire form on Gemini; error text conveys it.
- **Usage:** `promptTokenCount` → input; `candidatesTokenCount + thoughtsTokenCount` → output.
- **Finish reasons:** `MAX_TOKENS` → MaxTokens; everything else (STOP, SAFETY, ...) → EndTurn.

## Structured output

- **`response_format`** → `generationConfig.responseMimeType: "application/json"` + `responseJsonSchema`. `strict: true` is **rejected up front** (the API has no strict switch) rather than silently non-strict.
- **`ToolConstraint::Grammar`** → rejected (no grammar-constrained decoding).
- **`ToolConstraint::Strict`** → supported via schema tightening, same as the others.

## Streaming specifics

Gemini streams JSON chunks over SSE without a `[DONE]` sentinel — the terminal signal is a chunk carrying `finishReason`, and only that completes the turn (a stream without it is truncation). Proxies sometimes split the finish reason and the usage into separate final chunks; the client latches the latest non-empty `usageMetadata` and emits stop+usage together. Tool calls arrive as complete `functionCall` parts — the client emits them as open-fill-close sequences (part start, one JSON delta, part stop) so downstream consumers see the same shape as on other providers. Errors embedded in chunks classify by code/status: 429/503/529 or `RESOURCE_EXHAUSTED`/`UNAVAILABLE` → rate limit; else plain API error.

---

## Gotchas

1. **Images dropped** by the converter (same as the other shipped clients).
2. A non-reasoning model + `include_thoughts(true)` = 400 `INVALID_ARGUMENT`. Match the flag to the model.
3. Streaming usage from Gemini proxies can be partial — the client latches whatever arrives; `usage` may be `None` behind quirky proxies.
4. An empty `functionCall.args` normalizes to `{}`; a malformed args value passes through verbatim (visible to you, not hidden).

## Related pages

- [Overview](/providers/overview/) · [Structured output](/integration/structured-output/)
