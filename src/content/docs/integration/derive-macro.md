---
title: "`#[derive(Tool)]` — the Tool impl, written for you"
sidebar:
  order: 3
---


The derive macro turns a plain `Deserialize` struct into a full `Tool` implementation: name, description, schema, and dispatch — all generated from the type. Enable the `derive` feature; `use loopctl::Tool;` brings both the trait and the derive. Source: the `derive/` crate (`loopctl-derive`).

---

## The happy path

```rust
use loopctl::Tool;
use serde::Deserialize;

/// Search the notes for a query and return matches.     ← becomes description()
#[derive(Tool, Deserialize)]
#[tool(name = "search_notes")]                            // optional — default: search_notes_input's
struct SearchNotesInput {                                 //   struct name, snake_cased
    /// The text to look for.                             ← becomes the property description
    query: String,
    /// Maximum results. Omit for default.                ← Option<T> → not in "required"
    #[tool(default)]
    limit: Option<usize>,
}

impl SearchNotesInput {
    async fn run(&self, input: Self, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        Ok(ToolOutput::text(do_search(&input.query, input.limit).await))
    }
}

let mut tools = ToolRegistry::new();
tools.register(SearchNotesInput { query: String::new(), limit: None });  // the struct IS the tool
```

What gets generated: `impl Tool` with `name()`, `description()`, `schema()` (built from the fields), and `call()` — which deserializes the incoming JSON into your struct (failures become `ToolError::InvalidInput`) and calls your `run`.

## Every container attribute

| Attribute | Effect |
|---|---|
| `#[tool(name = "...")]` | the tool name (default: snake_case of the struct name) |
| `#[tool(description = "...")]` | the description (default: the struct's doc comment — **one of the two is required**) |
| `#[tool(handler = "my_method")]` | call `my_method` instead of `run` |
| `#[tool(read_only)]` | generates `is_read_only() -> true` |
| `#[tool(concurrency_safe)]` | generates `is_concurrency_safe() -> true` |
| `#[tool(system_prompt = "...")]` | generates the `system_prompt()` override |
| `#[tool(allow_extra)]` | omit `"additionalProperties": false` from the schema |

## Every field attribute

| Attribute | Effect |
|---|---|
| `#[tool(name = "...")]` | the JSON property name — **must agree with serde's** (a `#[serde(rename)]` mismatch is a compile error: the model would send one key while deserialization waits for another) |
| `#[tool(description = "...")]` | the property description (default: the field's doc comment) |
| `#[tool(skip)]` | leave the field out of the schema — requires `Option<T>` or `#[serde(default)]` |
| `#[tool(default)]` | keep in schema, omit from `required` — on non-`Option` fields requires `#[serde(default)]` |

## The type map — what your fields can be

| Rust type | JSON Schema |
|---|---|
| `String`, `&str`, `Cow<str>` | `string` |
| `bool` | `boolean` |
| any integer (`u8`…`i128`, `usize`) | `integer` |
| `f32`, `f64` | `number` |
| `Vec<T>` | `array` of `<T>` |
| `HashMap<String, T>`, `BTreeMap<String, T>` | `object` with values of `<T>` |
| `Option<T>` | the inner type's schema, **not** required |

Anything else (custom structs, enums, `serde_json::Value`) is a compile error pointing you at `#[tool(skip)]` or a manual `impl Tool` — the macro never guesses a wrong schema silently. Serde's `rename_all` strategies are respected for the derived property names (so `camelCase` APIs line up).

## The errors you might meet (all clear, all spanned)

- struct has no description and no doc comment
- generics ("implement it manually")
- tuple/unit structs, enums ("structs with named fields only")
- `skip` on a field without `Option`/serde-default
- `default` on a non-`Option` field without serde-default
- a `#[tool(name)]` disagreeing with serde's rename
- unknown attribute keys (the error lists what's accepted)

Never a panic — every failure is a normal compile error at the offending span.

## Under the hood (two details worth knowing)

- The generated `call` **clones the `ToolContext`** before building the future (the boxed future can't borrow it) — cheap, but it means your `run` gets its own owned context.
- The schema is emitted **statically** (`json!` in the generated code) — no runtime reflection, no extra dependencies. Downstream crates don't even need `serde_json` directly: generated code uses loopctl's private re-export.

## Derive vs `FnTool` vs manual — when which

| | Best for |
|---|---|
| `#[derive(Tool)]` | typed inputs, validated by the compiler, self-documenting — the default choice |
| `FnTool` | quick registration of a plain function, dynamic schemas |
| manual `impl Tool` | exotic types, computed schemas, input-dependent concurrency flags |

---

## Related pages

- [Tools](/core-data/tools/) — what the macro generates.
- [Presets](/integration/presets/) — the Constrained profile pairs beautifully with derived tools.
