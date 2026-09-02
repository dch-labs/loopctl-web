---
title: "`src/structured.rs` — structured (JSON) output"
---


Types and helpers for making the model answer in JSON you can parse.

**Key items**

- `StructuredOutput` trait — `name()`, `schema()`, `from_value()` (default: serde).
- `ResponseFormat { name, schema, strict }` + `from_type::<T>()` (strict default true).
- `RequestOptions { response_format, tool_constraint, model }` + builders (`with_model` ignores empty names).
- `ToolConstraint` — `None` / `Strict` / `Grammar(provider)` [grammar feature].
- `request_structured::<T>(client, messages, system)` — one-shot helper; **no parse-failure retry**.
- `StructuredError { Deserialize, Api }`.
- (internal) `parse_json_lenient` / `extract_json_substring` — the lenient JSON extractor; `tighten_json_schema` — the strict-mode schema transform.

**Behavior notes**

- A `response_format` **suppresses tools** for that request — the two share one slot.
- `strict: true` formats are rejected up front on Anthropic/Gemini (no strict switch there) — never a silent downgrade.
- Clients that can't honor options reject loudly (default `*_with_options` behavior).
- Tightening recurses through nesting and `$defs`, closes every object, and makes every property required — idempotent, and exactly what OpenAI strict mode requires.

Deep dive: [Structured output](/integration/structured-output/).
