---
title: "The derive macro"
sidebar:
  order: 3
---

The `#[derive(Tool)]` macro turns a plain `Deserialize` struct into a full `Tool` implementation. It generates your name, description, schema, and dispatch, all from the type.

Enable the `derive` feature, and `use loopctl::Tool` brings you both the trait and the derive. The source is the `crates/derive/` crate, published as `loopctl-derive`.

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

Here is what gets generated. You get an `impl Tool` with `name()`, `description()`, a `schema()` built from your fields, and `call()`.

That generated `call()` deserializes the incoming JSON into your struct, turns failures into `ToolError::InvalidInput`, and then calls your `run`.

## Every container attribute

| Attribute | Effect |
|---|---|
| `#[tool(name = "...")]` | Your tool name, defaulting to the snake_case of your struct name |
| `#[tool(description = "...")]` | The description, defaulting to the struct's doc comment. One of the two is required |
| `#[tool(handler = "my_method")]` | Calls `my_method` instead of `run` |
| `#[tool(read_only)]` | Generates `is_read_only() -> true` |
| `#[tool(concurrency_safe)]` | Generates `is_concurrency_safe() -> true` |
| `#[tool(system_prompt = "...")]` | Generates your `system_prompt()` override |
| `#[tool(allow_extra)]` | Omits `"additionalProperties": false` from the schema |

## Every field attribute

| Attribute | Effect |
|---|---|
| `#[tool(name = "...")]` | Your JSON property name, which must agree with serde. A `#[serde(rename)]` mismatch is a compile error, because your model would send one key while deserialization waits for another |
| `#[tool(description = "...")]` | The property description, defaulting to the field's doc comment |
| `#[tool(skip)]` | Leaves the field out of the schema, which requires `Option<T>` or `#[serde(default)]` |
| `#[tool(default)]` | Keeps the field in the schema and omits it from `required`. On a non-`Option` field this requires `#[serde(default)]` |

## The type map: what your fields can be

| Rust type | JSON Schema |
|---|---|
| `String`, `&str`, `Cow<str>` | `string` |
| `bool` | `boolean` |
| Any integer, meaning `u8` through `i128` and `usize` | `integer` |
| `f32`, `f64` | `number` |
| `Vec<T>` | `array` of `<T>` |
| `HashMap<String, T>`, `BTreeMap<String, T>` | `object` with values of `<T>` |
| `Option<T>` | The inner type's schema, and not required |

Anything else is a compile error that points you at `#[tool(skip)]` or a manual `impl Tool`. That covers custom structs, enums, and `serde_json::Value`. The macro never guesses a wrong schema silently.

## Serde rename parity: the schema follows deserialization

The derived property names mirror serde's own renaming rules exactly, so the schema your model sees and the struct serde deserializes can never disagree:

- `#[serde(rename_all = "...")]` converts your field names exactly as serde does,
  ASCII-only for the case-changing strategies, with `snake_case` and `lowercase` as
  identities on fields. The spelling `"SCREAMING-KEBAB-CASE"` is accepted in serde's form.

- The split form, `rename_all(serialize = "...", deserialize = "...")`, follows the
  deserialization side. Your model's input is what deserialization consumes, so that is
  the name your schema must advertise.

- `#[serde(default)]` is recognized even when it follows value-bearing serde keys like
  `with = "..."`.

- Flag keys reject `= value` and parenthesized misuse with a named error instead of being
  silently ignored.

Before 0.3.2 the conversion could invent names that serde rejects, so your schema and your deserializer disagreed. The parity is pinned now by trybuild fixtures under `crates/derive/tests/ui/`.

## The failure-mode matrix, at full breadth

The macro's error surface is pinned by a trybuild matrix of 28 compile-fail cases plus 3 pass cases, and it covers every attribute misuse.

The cases include an empty `name` or `description`, an empty doc comment used as the description, and a `handler` that names a non-identifier or a wrong-shaped method. Others cover `= value` on flag keys, non-string values, generics, lifetimes, private fields, and `#[serde(container)]` forms.

Each case asserts the exact compiler diagnostics, so an error message cannot drift silently.

A consumer hygiene fixture under `crates/derive/tests/consumer/` builds a downstream crate that depends on the macro the way a real consumer does. That catches expansion bugs an in-crate test structurally cannot see, because the generated code's references resolve in your dependency graph rather than the macro's.

One such bug was caught and fixed in 0.4.0. The expansion hard-coded `loopctl::` paths.

So a downstream manifest that renamed the dependency, through a `loopctl = { package = "loopctl" }` shadow or a workspace rename, failed to compile.

The expansion now goes through the re-export the derive feature provides, so a renamed
dependency works for you.

## The errors you might meet

Every failure is a normal compile error at the offending span, and never a panic. You will meet:

- A struct with no description and no doc comment.
- Generics, with a note to implement it manually.
- Tuple structs, unit structs, and enums, with a note that only structs with named fields
  are supported.
- `skip` on a field without `Option` or a serde default.
- `default` on a non-`Option` field without a serde default.
- A `#[tool(name)]` that disagrees with serde's rename.
- Unknown attribute keys, where the error lists what is accepted.

## Under the hood

Two details are worth knowing:

- The generated `call` clones your `ToolContext` before it builds the future, because the
  boxed future cannot borrow it. That is cheap, and it means your `run` gets its own owned
  context.
- The schema is emitted statically through `json!` in the generated code, so there is no
  runtime reflection and no extra dependencies. Your downstream crate does not even need
  `serde_json` directly, since the generated code uses loopctl's private re-export.

## Derive vs FnTool vs manual

| | Best for |
|---|---|
| `#[derive(Tool)]` | Typed inputs validated by the compiler, and self-documenting code. This is the default choice |
| `FnTool` | Quick registration of a plain function, and dynamic schemas |
| Manual `impl Tool` | Exotic types, computed schemas, and input-dependent concurrency flags |

## Related pages

- [Tools](/core-data/tools/) covers what the macro generates.
- [Presets](/integration/presets/) pairs the Constrained profile beautifully with derived
  tools.
