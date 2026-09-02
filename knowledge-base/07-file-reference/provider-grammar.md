# `src/provider/grammar.rs` — grammar constraints [feature: grammar]

Grammar-constrained tool calls for local, grammar-aware inference servers (vLLM's `guided_json`).

**Key items**

- `ToolGrammarProvider` trait — `grammar() -> &str`; implement it for other sampler dialects (GBNF, TGI).
- `JsonSchemaGrammar::from_schemas(&[ToolSchema])` — one merged, tightened JSON-Schema object serialized to a string; empty input yields a valid empty object.

**Behavior notes**

- Tightening matches the `Strict` path exactly — a grammar-guided sampler emits the shape strict-mode APIs would demand.
- Rides as `guided_json` in the OpenAI-compatible body, **alongside** the normal `tools` (grammar constrains the sampler, tools inform the model); omitted when no tools are registered.
- Rejected up front on Anthropic and Gemini (no grammar decoding there) — never a silent downgrade.
- Validated end-to-end against a local vLLM 7B server: ≥99% valid tool-call JSON over a fixed corpus (gated behind `LOOPCTL_E2E=1`).

Deep dive: [Grammar](../05-providers/07-grammar.md).
