---
title: "Tools — giving the model hands"
sidebar:
  order: 2
---


A **tool** is a function the model can ask your program to run: read a file, run a search, query a database. This page shows how to write one, register it, and what happens around every call. Sources: `src/tool.rs`, `src/tool/registry.rs`, the `derive/` crate.

---

## The Tool trait

A tool is any type implementing four things:

```rust
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;                 // unique id, e.g. "read_file"
    fn description(&self) -> &str;          // tells the MODEL what this does — write it well
    fn schema(&self) -> ToolSchema;         // describes the input in JSON Schema
    fn call(&self, input: Value, ctx: &ToolContext)
        -> Pin<Box<dyn Future<Output = Result<ToolOutput, ToolError>> + Send + '_>>;

    // Optional (defaults shown):
    fn is_concurrency_safe(&self) -> bool { false }
    fn is_safe_for_concurrent_execution(&self, _input: &Value) -> bool { self.is_concurrency_safe() }
    fn resource_key(&self, _input: &Value) -> Option<String> { None }
    fn is_read_only(&self) -> bool { false }
    fn system_prompt(&self) -> Option<String> { None }
}
```

**JSON Schema** (the `schema()` part) is a standard way to describe the shape of JSON data. The model reads it to learn what arguments to send. Example:

```rust
fn schema(&self) -> ToolSchema {
    ToolSchema {
        tool: "echo".into(),               // must equal name() — note the field is `tool`, not `name`
        description: "Echoes back the input".into(),
        input_schema: json!({
            "type": "object",
            "properties": { "message": { "type": "string" } },
            "required": ["message"]
        }),
    }
}
```

> **Gotcha:** the name field on `ToolSchema` is called **`tool`**, not `name`. Everyone trips on this once.

### The optional methods, in plain words

| Method | Meaning | Why it matters |
|---|---|---|
| `is_concurrency_safe` | Can two calls run at the same time safely? | Gates [parallel dispatch](/engine/tool-dispatch/). Default `false` (safe choice). |
| `is_safe_for_concurrent_execution(input)` | Same, but per-call — some inputs are safe, some not. | Overrides the static flag for one call. |
| `resource_key(input)` | A shared-resource tag, e.g. the file path being edited. | Two calls with the **same** key never run in the same parallel wave. |
| `is_read_only` | Does this tool change nothing? | Permission layers can auto-approve read-only tools. |
| `system_prompt` | Extra instructions appended to the system prompt. | E.g. a git tool explaining its conventions. |

---

## A complete tool, three ways

### Way 1: implement the trait

```rust
struct EchoTool;

impl Tool for EchoTool {
    fn name(&self) -> &str { "echo" }
    fn description(&self) -> &str { "Echoes the message back" }
    fn schema(&self) -> ToolSchema { /* as above */ }

    fn call(&self, input: Value, _ctx: &ToolContext)
        -> Pin<Box<dyn Future<Output = Result<ToolOutput, ToolError>> + Send + '_>>
    {
        let msg = input["message"].as_str().unwrap_or("").to_string();
        Box::pin(async move { Ok(ToolOutput::text(msg)) })
    }
}
```

### Way 2: `FnTool` — register a plain function

```rust
fn echo_fn(input: Value, _ctx: &ToolContext)
    -> Pin<Box<dyn Future<Output = Result<ToolOutput, ToolError>> + Send>> {
    let msg = input["message"].as_str().unwrap_or("").to_string();
    Box::pin(async move { Ok(ToolOutput::text(msg)) })
}

let echo = FnTool::new("echo", "Echoes the message back", json!({
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"]
    }), echo_fn as fn(_, _) -> _)
    .read_only();
```

### Way 3: `#[derive(Tool)]` — let a macro write it

Enable the `derive` feature, then describe the input as a struct and write an ordinary async method:

```rust
use loopctl::Tool;                       // brings the trait AND the derive
use serde::Deserialize;

/// Echoes the message back.                ← the doc comment becomes the description
#[derive(Tool, Deserialize)]
#[tool(name = "echo")]                     // optional; default is snake_case of the struct name
struct EchoInput {
    /// The message to echo.
    message: String,
}

impl EchoInput {
    async fn run(&self, input: EchoInput, _ctx: &ToolContext)
        -> Result<ToolOutput, ToolError>
    {
        Ok(ToolOutput::text(input.message))
    }
}

// register the struct itself:
registry.register(EchoInput { message: String::new() });
```

The macro generates `name()`, `description()` (from the doc comment or attribute), `schema()` (from the field types — `String` → string, `bool` → boolean, `Vec<T>` → array, `Option<T>` → not required), and `call()` (deserializes input into the struct, then calls `run`). Details and every attribute: [the derive macro page](/integration/derive-macro/).

---

## Output: `ToolOutput` and soft vs hard failure

```rust
let out = ToolOutput::text("file contents...");        // success
let out = ToolOutput::error_text("path not found");   // soft failure — still an Ok(…)
let out = ToolOutput::structured(&my_data);            // any Serialize → JSON text
let out = out.with_hint(DisplayHint::Diff);            // how a UI should render it
```

Two very different ways to fail, and the difference matters:

| Kind | Shape | What happens to the run |
|---|---|---|
| **Soft failure** | `Ok(ToolOutput { is_error: true, ... })` or an `Err(ToolError)` returned from `call` | The error text is fed back **to the model**. The run continues; the model can adapt. |
| **Hard failure** | The engine gives up: cancel, loop detected, retries exhausted | The run ends with a `LoopError`. |

A panicking tool is caught (`catch_unwind`) and becomes a soft failure — the model sees "tool 'x' panicked: ..." and the run continues.

`DisplayHint` (`Text`, `Diff`, `Json`, `Code`, `Markdown`, `Suppress`) is a **rendering suggestion only**. The loop ignores it; your UI can use it. `Suppress` means "show a preview in the UI" — the model still receives the full text.

The output type also carries the structured round-trip: `ToolOutput::structured(&any_serialize_value)` serializes into a JSON text payload (a serialization failure becomes an `error_text`, never a panic); `structured_value()` parses a JSON text payload back to a `Value` (`None` for multipart or non-JSON); `structured_as::<T>()` goes all the way to a typed value. And one join subtlety mirroring [messages](/core-data/messages/): `ToolOutput::text_content()` joins multipart text parts with **newlines**, while `Message::text_content()` concatenates with no separator — know which one your logging reads.

### `ToolError` variants and what the model should do

`NotFound`, `InvalidInput`, `Execution`, `Permission`, `FileNotFound`, `Timeout`, `Cancelled`, `Io`, `Json`. Each maps to advice for the model (invalid input → fix arguments; permission → ask the user; timeout → try a longer timeout...). loopctl's recovery machinery builds on these.

---

## `ToolContext` — what your tool receives

```rust
pub struct ToolContext {
    pub cwd: String,                 // working directory, default "."
    pub session_id: Uuid,            // which agent session is calling
    pub temp_dir: String,            // a private scratch directory for this session
    pub is_non_interactive: bool,    // true when no human is present
    pub user_context: HashMap<String, String>,   // free-form host data
    pub extensions: HashMap<TypeId, Arc<dyn Any + Send + Sync>>, // typed host data
}
```

- `temp_dir` deserves attention: `BareLoop` creates `{temp}/loopctl-{session_id}/` per session, gives every tool its path, and **removes it when the loop is dropped**. Clean scratch space, automatic cleanup. (`with_temp_dir(base)` moves it; `with_managed_temp_disabled()` opts out.)
- `extensions` is the escape hatch for host state: `ctx.set_extension(my_state)` / `ctx.get_extension::<MyState>()`. When the engine dispatches tools, the sanctioned place to enrich contexts is a middleware (register it first in your pipeline).
- There is **no** cancellation handle on the context. Cancellation is engine-side: your tool future is simply dropped when a cancel arrives mid-call. Write tools that are safe to drop mid-write (write to temp, rename at the end).

---

## `ToolRegistry` — the phone book

```rust
let mut tools = ToolRegistry::new();
tools.register(EchoTool);            // registers by name()
tools.register(EchoTool);            // same name again? silently REPLACES (warn log),
                                     // and keeps the original position in listing order

tools.get("echo")                    // Option<&dyn Tool>
tools.contains("echo")
tools.tool_names()                   // sorted alphabetically
tools.all_schemas()                  // Vec<ToolSchema> — what the model is shown
tools.all_tools()                    // everything, in registration order
tools.concurrent_safe_tools()        // only the concurrency-safe subset
```

The engine sends `all_schemas()` with every model request, and classifies model replies against `tool_names()`: a call to a name that was never advertised is answered with "tool 'x' is not available" before any dispatch happens (see [tool dispatch](/engine/tool-dispatch/)).

An ordering subtlety pinned by the implementation: `all_tools()` returns **registration order** (a re-registered name keeps its original slot), `tool_names()` returns **alphabetical order**, but `all_schemas()` iterates the internal storage map and is **order-unspecified** — the tool list the model sees can differ between processes. Nothing in the engine depends on schema order; if your tests or prompts do, sort the list yourself.

---

## Built-in tools — `ThinkTool`

The crate ships its first ready-made tool behind the `builtin_tools` feature: **`ThinkTool`**, a no-side-effect scratchpad the model reasons into before acting. It advertises exactly one field — `think(thought)` → the constant reply `"ok"`.

The point is not the acknowledgement (the thought is already in the conversation as the call's input — echoing it back would double its token cost). The point is the **description**: it is written as an instruction template — restate the goal, list the options, check the plan against the constraints, decide — so the tool *teaches the procedure* rather than just naming itself. On small local models this is the cheap version of "think before you act": the reasoning happens in the open, in the transcript, where later turns can see it.

Facts worth knowing:

- `is_read_only()` and `is_concurrency_safe()` are `true` by definition — the tool touches nothing.
- A missing or non-string `thought` field is a `ToolError::InvalidInput` naming the field.
- Registration is the only way it enters a session: enable `builtin_tools`, construct `tool::builtin::ThinkTool`, register it like any other tool. Nothing is auto-installed and `default = []` is unchanged.

---

## Schemas — brief but important

- The framework does **not** validate your schema. A broken schema means the model sends broken arguments. Test it.
- With `ToolConstraint::Strict` (see [structured output](/integration/structured-output/)), loopctl *tightens* schemas automatically: every object becomes closed (`additionalProperties: false`) and every property becomes required — the shape strict-mode APIs demand.
- Under the MCP server adapter, schemas are validated with a real JSON Schema validator before being advertised; tools with invalid schemas are skipped with a warning (see [MCP](/integration/mcp/)).

---

## Related pages

- [Tool dispatch](/engine/tool-dispatch/) — everything that wraps each call.
- [Middleware](/safety/middleware/) — timeouts, caching, permissions as stackable layers.
- [The derive macro](/integration/derive-macro/) — every attribute explained.
- [File reference: tool.rs](/file-reference/tool/)
