---
title: "Anthropic client"
sidebar:
  order: 3
---

`AnthropicClient` speaks the Anthropic Messages protocol. The source is `src/provider/anthropic.rs`. The same client serves Z.ai's Anthropic-compatible endpoint through `provider::zai()`, with base `https://api.z.ai/api/anthropic` and default model `glm-4.7`.

## Construction

```rust
let client = AnthropicClient::from_env()?;   // ANTHROPIC_API_KEY, optional _BASE_URL / _MODEL

let client = AnthropicClient::builder()
    .with_api_key(key)
    .with_model("claude-sonnet-4-20250514")  // the default
    .with_max_tokens(8192)                   // required by the API; default 8192, 0 rejected
    .build()?;
```

`max_tokens` is your reply's length budget, and the Messages API requires it. loopctl defaults it to 8192 and rejects 0 at build time with a clear message.

Your auth header is `x-api-key`, alongside `anthropic-version: 2023-06-01`.

## What this client translates for you

### System prompts

Anthropic has no inline system role mid-conversation. The client folds any system messages out of your conversation and merges them into the top-level `system` field, with your configured prompt first and the folded text appended.

The field is always sent, as an empty string when there is nothing to send. You never construct this by hand.

### Tool calls and results

Your assistant tool calls become `tool_use` content blocks, and your results become `tool_result` blocks carrying `tool_use_id`. Unlike OpenAI, the `is_error` flag travels on the wire. It is set only on errors, because success omits it.

Adjacent assistant messages are merged since 0.4.1. After system-folding, the request build folds runs of adjacent assistant messages into one message, with a `\n\n` separator when two texts would otherwise glue.

Some Anthropic-compatible providers, Z.ai's GLM among them, reject the adjacent shape with `HTTP 400 [1214]`, so the merge is a safety net behind the machine's own compaction seam. Whatever a compactor or host hands this client, your wire carries a legal shape.

### Thinking and extended reasoning

`thinking` and `redacted_thinking` blocks stream on a dedicated thinking lane (0.4.0). Visible reasoning arrives as `on_thinking_delta` fragments, and redacted reasoning arrives as an empty-text thinking delta that carries its opaque payload.

The client latches signatures into `MessagePart::Thinking`. Those are the `signature` on visible blocks and the `redacted` payload on withheld ones.

Continuation requests replay prior turns' thinking blocks verbatim when `replay_reasoning(true)` is on the builder, which is the default. Two reasons:

- Some Anthropic models refuse to continue a conversation whose earlier thinking lacks a valid signature, so that round trip is load-bearing.
- Keeping the history byte-stable also keeps the provider's prompt caches hitting.

### Usage accounting

Input tokens arrive on `message_start` and output tokens on `message_delta`. The client latches both and merges by max per counter, so a downward revision never under-reports your usage.

Cache reporting needs one normalization. `cache_read_input_tokens` fills `Usage::cached_input_tokens`, and Anthropic's raw `input_tokens` excludes cache traffic, so the client reports input as raw plus cache reads plus cache-creation spend. That keeps the cached share a true subset of the reported input.

## Structured output: the forced-tool trick

Anthropic has no native `response_format`, so when you request one the client synthesizes it as a single forced tool:

```text
tools:      [ { name: <your format name>, description: "Return the result via this tool",
               input_schema: <your schema> } ]
tool_choice: { type: "tool", name: <your format name> }
```

Your model's answer lands in the `tool_use` block's `input`, and `extract_structured` picks it up automatically.

Two requests are rejected before sending rather than silently degraded:

- `response_format.strict == true` is rejected with `ApiError::config_validation`, because Anthropic has no strict switch.
- `ToolConstraint::Grammar` is rejected, because this API has no grammar-constrained decoding.

`ToolConstraint::Strict` is supported, through schema tightening with `additionalProperties: false` and full `required`, which is what Anthropic validates server-side.

## Prompt-cache breakpoints

A multi-turn loop re-sends the whole conversation on every request. The provider's prompt cache exists to keep that cheap, but your wire has to ask for it.

`AnthropicClientBuilder::prompt_caching(true)` marks up to four `cache_control` breakpoints on every request. Both wire paths do this, because streaming and non-streaming share one body-builder exit and can never disagree.

The four breakpoints:

1. The last tool definition, which is your stable, slowly-changing prefix.
2. The system prompt, rewritten from its plain-string form into one marked text block. An empty system stays a string, because marking nothing buys no cache.
3. and 4. The last two eligible content blocks of the final message. That placement keeps the previous request's prefix cached while it rolls the frontier forward one turn at a time.

Two rules shape the placement:

- Thinking and redacted-thinking blocks are skipped as breakpoints, because the provider rejects `cache_control` on them. A signed-thinking tail marks the text blocks around it instead.
- A final message whose content is a plain string is wrapped into a one-block array so it can carry the marker.

Caching is off by default, and then your requests stay byte-identical to a client that never asked to cache.

## Streaming

Events arrive as typed SSE, meaning `event:` and `data:` lines: `message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`, and `error`.

The client maps them onto the neutral events while tracking which content block each delta belongs to. Anthropic's tool-input deltas carry no index, so it is remembered from the block start.

`message_stop` is the terminal event, and its absence means truncation. Mid-stream `error` events map by type, where `rate_limit_error` and `overloaded_error` become `ApiError::RateLimit` and everything else becomes `ApiError::api`.

## Bedrock shares this code

The Bedrock client's Anthropic-native path reuses this file's body builders, system folding, and stream emitter. That is one implementation over two transports. See [Bedrock](/providers/bedrock/).

## Gotchas

1. Images are dropped by the converter, because the data model carries them and the wire does not.

2. Your tool schemas must be valid JSON Schema Draft 07, because Anthropic validates server-side. `ToolConstraint::Strict` tightens yours automatically.

3. `max_tokens` caps the reply, so a `MaxTokens` stop reason on a long structured answer usually means you should raise it.

4. If you use Z.ai, `provider::zai()` is this client. Everything above applies, including thinking-lane behavior for GLM models that emit reasoning.

## Related pages

- [Overview](/providers/overview/) is the provider map.
- [Structured output](/integration/structured-output/) covers the constraint modes.
- [Bedrock](/providers/bedrock/) covers the other transport.
