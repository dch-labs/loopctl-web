# Reasoning fidelity

Reasoning fidelity keeps a model's thinking alive across tool turns. A reasoning model emits its thoughts beside its answer, and the provider signs each thought block. Send the signed block back unchanged, and the model continues its own reasoning thread.

Drop it, and your model re-reasons from scratch or the provider refuses the request. Added in 0.6.0. Source: `src/provider/gemini.rs`, `src/provider/bedrock.rs`, `src/message.rs`.

You get this for free when you keep whole `Message` objects in your history. The engine does that already. Read on to see which fields carry the tokens and what each provider does with them.

## What rides on the parts

Two message parts carry fidelity state. `MessagePart::Thinking` has a `signature` for the provider's signature and a `redacted` payload for withheld reasoning. `MessagePart::ToolCall` has a `signature` for Gemini, which attaches the token to the call itself.

Build a signed call yourself with the constructor added in 0.6.0.

```rust
let part = MessagePart::tool_call_with_signature(
    "call_1",
    "get_weather",
    serde_json::json!({"city": "Paris"}),
    Some("c2lnbmF0dXJl".to_string()),
);
```

Notice the signature is an `Option<String>` you pass verbatim. loopctl never synthesizes one. Old serialized histories deserialize with `None`, because the field defaults both ways.

## What each provider round-trips

The table states the boundary per dialect. "Native" means the block rides back in the provider's own wire shape.

| Provider | Signed thinking | Redacted thinking | Signature on a tool call |
| --- | --- | --- | --- |
| Gemini | Native. The text, `thought: true`, and `thoughtSignature` ride back verbatim. | Dropped. The dialect has no wire shape for it. | Carried on the call, replayed beside it. |
| Bedrock Converse | Native, as `reasoningText` with text and signature. | Native, as `redactedContent`. | Dropped. The wire has no carrier. |
| Bedrock invoke | Through the Anthropic converter. | Through the Anthropic converter. | Dropped. |
| Anthropic | Native, while the effective effort budgets a thinking block. | Native. | Dropped. |
| OpenAI family | Text only, through `reasoning_content` when replay is on. | Dropped. | Dropped. |

Unsigned thinking is skipped unless the dialect replays it as text. The OpenAI family rides it through `reasoning_content` when replay is on, and the builder leaves replay off by default. Each skip and each text replay is counted on the reasoning metrics. See [metrics](../06b-telemetry/01-metrics.md) for the rows.

## The rules that hold everywhere

Four rules hold on every dialect you use.

1. Nothing is invented. A signature that never arrived never rides.
2. Whole blocks ride verbatim. The text and its token travel together.
3. Foreign state answers one way. A part carrying both a signature and a redacted payload is out of contract, and each dialect picks its half and pins the choice with a test.
4. The redaction middleware cannot touch this lane. It scrubs your tool output text, and thinking fields ride on conversation parts.

Rule 4 has a sharp edge. A tool that echoes a signature's bytes in its output has that echo scrubbed, because the entropy heuristic hunts exactly those bytes. The conversation's own fields still ride untouched.

## Gotchas

1. Gemini non-streaming responses now contain `MessagePart::Thinking` parts where earlier versions dropped them. Expect reasoning where your code used to see an empty parts vector.
2. Exhaustive matches over `MessagePart::ToolCall` need the new `signature` field or a `..` rest pattern.
3. Bedrock Converse streams may omit the reasoning block start. A reasoning delta for an index with no open slot opens the thinking lane itself, so your capture holds either way. Pinned in 0.6.0 with the delta-first sequence.

## Related pages

- [Messages](01-messages.md) covers the part types that carry the tokens.
- [Gemini](../05-providers/04-gemini.md) and [Bedrock](../05-providers/05-bedrock.md) cover the per-provider wire shapes.
- [Stream events](04-stream-events.md) covers how thinking deltas accumulate.
