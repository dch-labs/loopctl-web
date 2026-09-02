# Grammar constraints — steering local models' tool calls [feature: grammar]

Small local models (7B-class) often emit *almost*-valid tool-call JSON — a missing quote, a trailing comma. Cloud APIs fix this with "strict mode," but local inference servers (vLLM and friends) fix it differently: **grammar-constrained decoding** — the sampler is only allowed to produce text that matches a given grammar. loopctl's `grammar` feature generates that grammar from your tool schemas. Source: `src/provider/grammar.rs`.

---

## The pieces

```rust
// The trait — implement it to target other sampler dialects:
pub trait ToolGrammarProvider: Send + Sync + Debug {
    fn grammar(&self) -> &str;
}

// The shipped implementation: build a JSON grammar from tool schemas:
let provider = JsonSchemaGrammar::from_schemas(&registry.all_schemas());
```

`JsonSchemaGrammar` merges your tools into one JSON-Schema object — `{"type":"object","properties":{"tool_a": <tightened schema>, ...},"additionalProperties":false}` — serialized as a string. Each tool's schema is **tightened** first (every object closed, every property required), the same transform strict-mode APIs demand, so a sampler guided by this grammar emits the shape strict mode would enforce.

## Using it

```rust
use loopctl::structured::{RequestOptions, ToolConstraint};

let options = RequestOptions::new()
    .with_tool_constraint(ToolConstraint::Grammar(Arc::new(provider)));

agent.set_request_options(options);   // applies to every model request
```

On the wire (OpenAI-compatible servers): the request carries `guided_json: <grammar>` — vLLM's field — **alongside** the normal `tools` list. The grammar constrains the sampler; the tools list tells the model what exists. With no tools registered, `guided_json` is omitted (nothing to force).

Compatibility, enforced loudly:

| Provider | Grammar support |
|---|---|
| OpenAI-compatible servers (vLLM, etc.) | ✅ `guided_json` |
| Anthropic | ❌ rejected up front — no grammar decoding on that API |
| Gemini | ❌ rejected up front |

Rejections are `ApiError::config_validation` **before** any request is sent — never a silent downgrade to unconstrained calls.

## The three constraint modes, one table

`ToolConstraint` (see [structured output](../06-integration/01-structured-output.md)):

| Mode | Mechanism | Where it works |
|---|---|---|
| `None` (default) | schemas advertised as-is; malformed calls detected and answered, not prevented | everywhere |
| `Strict` | provider-native strict tool schemas (tightened) | OpenAI native; Anthropic/Gemini via tightened schemas |
| `Grammar(provider)` | sampler-level grammar (`guided_json`) | grammar-aware local servers |

`Grammar` exists precisely for the local/small-model case where there is no cloud strict mode but you control the sampler.

## Evidence it works

The crate's end-to-end suite (run against a local vLLM server, gated behind `LOOPCTL_E2E=1`) drives a 7B model over a fixed corpus with the grammar enabled and asserts **≥99% valid tool-call JSON** — accumulated through the same `InputJson` fragments the engine consumes in production.

## Related pages

- [Structured output](../06-integration/01-structured-output.md) — the other constraint modes.
- [OpenAI client](02-openai.md) — the wire this rides on.
