---
title: "Anthropic client — Claude, and how its quirks are handled"
sidebar:
  order: 3
---


`AnthropicClient` speaks the Anthropic Messages protocol. Source: `src/provider/anthropic.rs`. The same client serves Z.ai's Anthropic-compatible endpoint (`provider::zai()` — base `https://api.z.ai/api/anthropic`, default model `glm-4.7`).

---

## Construction

```rust
let client = AnthropicClient::from_env()?;   // ANTHROPIC_API_KEY, optional _BASE_URL / _MODEL

let client = AnthropicClient::builder()
    .with_api_key(key)
    .with_model("claude-sonnet-4-20250514")  // the default
    .with_max_tokens(8192)                   // required by the API; default 8192, 0 rejected
    .build()?;
```

`max_tokens` (the reply's length budget) is required by the Messages API — loopctl defaults it to 8192 and rejects 0 at build time with a clear message. Auth header: `x-api-key`, plus `anthropic-version: 2023-06-01`.

## What this client translates for you

**System prompts.** Anthropic has no inline system role mid-conversation. The client *folds* any system messages out of the conversation and merges them into the top-level `system` field (your configured prompt first, folded text appended). The field is always sent (empty string when there's nothing). You never construct this by hand.

**Tool calls and results.** Assistant tool calls become `tool_use` content blocks; your results become `tool_result` blocks carrying `tool_use_id` and — unlike OpenAI — the **`is_error` flag travels on the wire** (`true` only; success omits it).

**Thinking (extended reasoning).** `thinking` and `redacted_thinking` blocks stream as a dedicated thinking lane: `on_thinking_delta` fragments for visible reasoning; redacted reasoning arrives as exactly one *empty* thinking delta (render a placeholder). Signatures are ignored; non-streaming replies skip thinking blocks entirely (reasoning is stream-only by design).

**Usage accounting.** Input tokens arrive on `message_start`, output on `message_delta` — the client latches both and merges by **max** per counter, so a downward revision never under-reports.

## Structured output — the forced-tool trick

Anthropic has no native `response_format`. When you request one, the client **synthesizes it as a single forced tool**:

```text
tools:      [ { name: <your format name>, description: "Return the result via this tool",
               input_schema: <your schema> } ]
tool_choice: { type: "tool", name: <your format name> }
```

The model's answer lands in the `tool_use` block's `input` — which `extract_structured` picks up automatically. Two rejections happen **before sending**, rather than silently degrading:

- `response_format.strict == true` → rejected (Anthropic has no strict switch): `ApiError::config_validation`.
- `ToolConstraint::Grammar` → rejected (no grammar-constrained decoding on this API).

`ToolConstraint::Strict` *is* supported — via schema tightening (`additionalProperties: false`, full `required`), which is what Anthropic validates server-side.

## Streaming

Events arrive as typed SSE (`event:` + `data:` lines): `message_start`, `content_block_start/delta/stop`, `message_delta`, `message_stop`, `error`. The client maps them onto the neutral events, tracking which content block each delta belongs to (Anthropic's tool-input deltas carry no index — it's remembered from the block start). `message_stop` is the terminal event; its absence means truncation. Mid-stream `error` events map by type: `rate_limit_error` / `overloaded_error` → `ApiError::RateLimit`; everything else → `ApiError::api`.

## Bedrock shares this code

The Bedrock client's Anthropic-native path reuses this file's body builders, system folding, and stream emitter — one implementation, two transports. See [Bedrock](/providers/bedrock/).

---

## Gotchas

1. **Images are dropped** by the converter (data model carries them; wire doesn't).
2. **Tool schemas must be valid JSON Schema Draft 07** — Anthropic validates server-side. `ToolConstraint::Strict` tightens yours automatically.
3. **`max_tokens` caps the reply** — a `MaxTokens` stop reason on long structured answers usually means: raise it.
4. **Z.ai users:** `provider::zai()` is this client — everything above applies, including thinking-lane behavior for GLM models that emit reasoning.

## Related pages

- [Overview](/providers/overview/) · [Structured output](/integration/structured-output/) · [Bedrock](/providers/bedrock/)
