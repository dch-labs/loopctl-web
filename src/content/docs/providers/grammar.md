---
title: "Grammar constraints"
sidebar:
  order: 7
---

Small local models in the 7B class often emit almost-valid tool-call JSON. You get a missing quote or a trailing comma.

Cloud APIs fix this with strict mode. Local inference servers such as vLLM fix it differently, through grammar-constrained decoding, where the sampler is only allowed to produce text that matches a given grammar. `grammar` is the feature that generates one from your tool schemas, and the source is `src/provider/grammar.rs`.

## The pieces

```rust
// The trait — implement it to target other sampler dialects:
pub trait ToolGrammarProvider: Send + Sync + Debug {
    fn grammar(&self) -> &str;
}

// The shipped implementation: build a JSON grammar from tool schemas —
// and FAIL LOUD at construction (0.4.0) if the schemas can't produce one:
let provider = JsonSchemaGrammar::from_schemas(&registry.all_schemas())?;
```

`JsonSchemaGrammar` merges your tools into one JSON-Schema object, serialized as a string. The shape is `{"type":"object","properties":{"tool_a": <tightened schema>, ...},"additionalProperties":false}`.

Each tool's schema is tightened first, which means every object closed and every property required. That is the same transform a strict-mode API demands, so a sampler guided by this grammar emits the shape strict mode would enforce.

## Using it

```rust
use loopctl::structured::{RequestOptions, ToolConstraint};

let options = RequestOptions::new()
    .with_tool_constraint(ToolConstraint::Grammar(Arc::new(provider)));

agent.set_request_options(options);   // applies to every model request
```

On the wire for OpenAI-compatible servers, your request carries `guided_json` with the grammar, which is vLLM's field, alongside the normal `tools` list.

Each part has a job. The grammar constrains the sampler, and the tools list tells the model what exists. With no tools registered, `guided_json` is omitted, because there is nothing to force.

## Compatibility, enforced loudly

| Provider | Grammar support |
|---|---|
| OpenAI-compatible servers such as vLLM | Yes, through `guided_json` |
| Anthropic | No, rejected up front, because that API has no grammar decoding |
| Gemini | No, rejected up front |

A rejection is an `ApiError::config_validation` raised before any request is sent. You never get a silent downgrade to unconstrained calls.

## The three constraint modes

`ToolConstraint` is covered in [structured output](/integration/structured-output/):

| Mode | Mechanism | Where it works |
|---|---|---|
| `None`, the default | Schemas are advertised as-is, and malformed calls are detected and answered rather than prevented | Everywhere |
| `Strict` | Provider-native strict tool schemas, tightened | OpenAI native, and Anthropic or Gemini through tightened schemas |
| `Grammar(provider)` | Sampler-level grammar through `guided_json` | Grammar-aware local servers |

`Grammar` exists precisely for your local and small-model case, where there is no cloud strict mode but you do control the sampler.

## Fail loud, and be honest about the envelope

Two behaviors define this feature.

`from_schemas` is fail-loud. It returns a `Result` and refuses at construction when your schemas cannot yield a usable grammar. Earlier builds let a broken schema silently produce whatever it produced.

The old claim of at least 99% valid tool-call JSON is retired. The evidence is now stated as what it is: a run over a local-server corpus, which is not a guarantee for your sampler.

What the code does guarantee is narrower. The grammar rides the request alongside the tools list, exactly as described, and is never silently dropped.

## Related pages

- [Structured output](/integration/structured-output/) covers the other constraint modes.
- [OpenAI client](/providers/openai/) covers the wire this rides on.
