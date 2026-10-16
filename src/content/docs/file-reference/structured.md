---
title: "src/structured.rs"
---

This file holds the types and helpers you use to make your model answer in JSON you can parse. Read it before you mix structured output with tool calls, because the two compete.

## Key items

Your `StructuredOutput` trait gives you `name()`, `schema()`, and `from_value()`, where serde supplies the default.

`ResponseFormat { name, schema, strict }` plus `from_type::<T>()` builds a format, and strict defaults to true.

`RequestOptions { response_format, tool_constraint, model }` carries your per-request switches through its builders, and `with_model` ignores empty names.

`ToolConstraint` offers `None`, `Strict`, or `Grammar(provider)`, which you reach under the `grammar` feature.

`ThinkingEffort` plus `RequestOptions::effort(...)` (0.4.0) gives you Off, Low, Medium, High, and Max for reasoning models, and `RequestOptions` stays `#[non_exhaustive]`.

`request_structured::<T>(client, messages, system)` is your one-shot helper, and it runs with no parse-failure retry.

`StructuredError { Deserialize, Api }` is what your caller matches on. Internally you get `parse_json_lenient` and `extract_json_substring` for the lenient extractor, plus `tighten_json_schema` for the strict-mode transform.

## Behavior notes

A `response_format` suppresses tools for that request, because the two share one slot.

`strict: true` formats are rejected up front on Anthropic and Gemini, which have no strict switch, so you never eat a silent downgrade.

Clients that cannot honor options reject loudly, which is the default `*_with_options` behavior.

Tightening recurses through nesting and `$defs`, closes every object, and makes every property required. It is idempotent, and it is exactly what OpenAI strict mode requires.

Deep dive: [Structured output](/integration/structured-output/).
