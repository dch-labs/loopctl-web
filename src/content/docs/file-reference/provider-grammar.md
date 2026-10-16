---
title: "src/provider/grammar.rs"
---

This file builds grammar-constrained tool calls for local, grammar-aware inference servers such as vLLM's `guided_json`. It rides the `grammar` feature.

## Key items

The `ToolGrammarProvider` trait exposes `grammar() -> &str`, and you implement it for other sampler dialects such as GBNF or TGI.

`JsonSchemaGrammar::from_schemas(&[ToolSchema])` returns one merged, tightened JSON-Schema object serialized to a string, and empty input yields a valid empty object.

It returns `Result` since 0.4.0, so construction fails loud when the schemas cannot yield a usable grammar.

## Behavior notes

Tightening matches the `Strict` path exactly, so a grammar-guided sampler emits the shape strict-mode APIs would demand.

Your grammar rides as `guided_json` in the OpenAI-compatible body, alongside the normal `tools`, because the grammar constrains the sampler while tools inform the model.

It is omitted when no tools are registered. Anthropic and Gemini reject it up front, since neither does grammar decoding there, so you never get a silent downgrade.

This path is validated end-to-end against a local vLLM 7B server, reaching at least 99% valid tool-call JSON over a fixed corpus. That test is gated behind `LOOPCTL_E2E=1`.

For the deep dive, see [Grammar](/providers/grammar/).
