---
title: "Tools"
sidebar:
  order: 2
---

A tool is a function the model can ask your program to run: read a file, run a search, query a database. You write it, you register it, and the engine calls it when the model asks.

Three routes reach the same result. The sections after them cover what happens once per call. Sources: `src/tool.rs`, `src/tool/registry.rs`, and the `crates/derive/` crate.

## The Tool trait

A tool is any type that implements four required methods:

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

The first three methods are metadata the model reads. The fourth is the code you want running.

`schema()` returns JSON Schema, which is the standard way to describe the shape of JSON data. The model reads it to learn which arguments to send, so write it as carefully as the function body. Example: an echo tool's schema.

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

One field name trips up everyone who writes this by hand. The name field on `ToolSchema` is `tool`, not `name`.

### Optional methods

The trait's defaults cover most tools. Each one changes how the engine schedules or renders your tool:

| Method | Meaning | Why it matters |
|---|---|---|
| `is_concurrency_safe` | Can two calls run at the same time safely? | Gates [parallel dispatch](/engine/tool-dispatch/). Default `false`, which is the safe choice. |
| `is_safe_for_concurrent_execution(input)` | Same question, answered per-call. Some inputs are safe and some are not. | Overrides the static flag for one call. |
| `resource_key(input)` | A shared-resource tag, such as the file path being edited. | Two calls with the same key never run in the same parallel wave. |
| `is_read_only` | Does this tool change nothing? | Permission layers can auto-approve read-only tools. |
| `system_prompt` | Extra instructions appended to the system prompt. | A git tool can explain its own conventions. |
| `descriptor_digest()` | A 16-hex fingerprint of `{name, description, schema}` over canonical JSON. | First-use approval can pin what the user actually saw. A changed digest is the re-ask signal, and the default derives it automatically. See [approvals](/safety/approvals/). |
| `records_trajectory()` | Should calls to this tool become memory entries? Default `true`. | A tool that recorded its own answers would find them in the next search, so `SearchMemoriesTool` opts out. |

## A complete tool, three ways

### Implement the trait

The explicit route works everywhere and shows you what the other two generate:

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

That `Pin<Box<dyn Future ...>>` return type is the price of an object-safe trait. Read it as "an async function you can store in a list".

### Register a plain function

`FnTool` wraps a free function, so a tool can be one function and no struct:

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

The trailing `.read_only()` is where the optional methods live. `FnTool` has a builder method for each one.

### Derive the trait

Enable the `derive` feature, describe the input as a struct, and write an ordinary async method:

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

The macro writes the rest of the trait. Your tool's name comes from the attribute, or from the snake_case struct name if you leave the attribute off. The doc comment becomes the description.

`schema()` comes from the field types. `String` becomes string, `bool` becomes boolean, `Vec<T>` becomes array, and `Option<T>` becomes not required.

The macro is `#[derive(Tool)]`, and you put it on a `Deserialize` struct. `call()` deserializes the input into your struct, then calls `run`. [The derive macro page](/integration/derive-macro/) lists every attribute.

## ToolOutput

A tool returns one of these:

```rust
let out = ToolOutput::text("file contents...");        // success
let out = ToolOutput::error_text("path not found");   // soft failure — still an Ok(…)
let out = ToolOutput::structured(&my_data);            // any Serialize → JSON text
let out = out.with_hint(DisplayHint::Diff);            // how a UI should render it
```

### Soft and hard failure

Two very different ways to fail, and the difference decides whether the run survives:

| Kind | Shape | What happens to the run |
|---|---|---|
| Soft failure | `Ok(ToolOutput { is_error: true, ... })` or an `Err(ToolError)` returned from `call` | The error text is fed back to the model. The run continues, and the model can adapt. |
| Hard failure | The engine gives up: cancel, loop detected, retries exhausted | The run ends with a `LoopError`. |

A panicking tool is caught with `catch_unwind` and becomes a soft failure. The model sees "tool 'x' panicked: ..." and the run continues.

### Rendering hints

`DisplayHint` has six variants: `Text`, `Diff`, `Json`, `Code`, `Markdown`, `Suppress`. Treat it as a rendering suggestion only. The loop ignores it, and your UI can use it. `Suppress` means show a preview in the UI, while the model still receives the full text.

### Structured payloads

`ToolOutput::structured(&value)` serializes anything that implements `Serialize` into a JSON text payload. A serialization failure becomes an `error_text`, never a panic.

Reading it back completes the structured round-trip, and it has three depths. `structured_value()` parses a JSON text payload into a `Value`, and returns `None` for multipart or non-JSON. `structured_as::<T>()` goes all the way to a typed value.

One join rule differs from [messages](/core-data/messages/), so check which one your logging reads. `ToolOutput::text_content()` joins multipart text parts with newlines, while `Message::text_content()` concatenates with no separator.

A tool can also stamp a retention class on its output with `ToolOutput::text(...).with_retention(Retention::Durable)`. The tag rides the result into the conversation and tells compaction and pruning what may be cleared and when. See [retention classes](/core-data/messages/#retention-classes).

### ToolError variants

Nine variants cover tool failure: `NotFound`, `InvalidInput`, `Execution`, `Permission`, `FileNotFound`, `Timeout`, `Cancelled`, `Io`, and `Json`.

Each one carries advice for the model. Invalid input means fix the arguments. Permission means ask the user. Timeout means try a longer timeout. loopctl's recovery machinery builds on this list, so pick the honest variant when you return an error.

## ToolContext

Every call receives this:

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

Three fields deserve attention:

- `temp_dir` is worth using. `BareLoop` creates `{temp}/loopctl-{session_id}/` per session, gives every tool that path, and removes the directory when the loop is dropped. You get clean scratch space with automatic cleanup. Call `with_temp_dir(base)` to move it, or `with_managed_temp_disabled()` to opt out.
- `extensions` is the escape hatch for host state. Use `ctx.set_extension(my_state)` and `ctx.get_extension::<MyState>()`. When the engine dispatches tools, the sanctioned place to enrich contexts is a middleware, and you register it first in your pipeline.
- There is no cancellation handle on the context. Cancellation is engine-side: your tool future is dropped when a cancel arrives mid-call. Write tools that are safe to drop mid-write, such as writing to a temp file and renaming at the end.

## ToolRegistry

The registry maps names to tools, and registration is by `name()`:

```rust
let tools = ToolRegistry::new();
tools.register(EchoTool);            // registers by name()
tools.register(EchoTool);            // same name again? silently REPLACES (warn log),
                                     // and keeps the original position in listing order

tools.get("echo")                    // Option<Arc<dyn Tool>> (owned handle, 0.4.1)
tools.contains("echo")
tools.tool_names()                   // sorted alphabetically
tools.all_schemas()                  // Vec<ToolSchema> — what the model is shown
tools.all_tools()                    // everything, in registration order
tools.concurrent_safe_tools()        // only the concurrency-safe subset
```

Re-registering a name replaces the tool silently, apart from a warn log, and the new tool keeps the old slot in listing order.

### The registry is runtime-mutable (0.4.1)

Your tool set is no longer frozen at construction. The registry's tools live behind an interior lock, so you can register and remove while a run is in flight:

```rust
let registry = agent.tool_registry();   // Arc<ToolRegistry> — the mutation handle
registry.register(NewTool::new());      // advertised on the very next request
registry.remove("OldTool");             // in-flight calls to it still drain
registry.version()                      // u64 — bumped by every mutation
```

Three contracts make your mid-run mutation safe:

- Registration is advertisement-immediate. The engine reads the registry when it builds the next turn's request, so a tool you register mid-run rides that request.
- Removal is execution-draining. Dispatch holds an owned `Arc<dyn Tool>`, so an in-flight call completes against the handle it fetched. The next call to the removed name fails through the typed unknown-tool path.
- Every mutation bumps `version`, which the engine watches twice. Your cached overhead reservation re-measures on a move, and each turn reads the surface and its version as one registry-atomic pair through `versioned_surface()`. A reader never pairs a new surface with an old count.

Mutations surface to your observers as `on_tool_surface_changed` with a name-sorted diff. See [observers](/extensions/observers/). The signature changes from 0.4.1: `register` takes `&self`, so your existing call sites compile unchanged. `get` returns an owned `Option<Arc<dyn Tool>>`, and `all_tools` and `concurrent_safe_tools` return `Vec<Arc<dyn Tool>>`. The pattern `registry.get(name)?.call(...)` compiles unchanged through `Arc`'s `Deref`.

### Advertising a subset (0.4.1)

The registered surface and the advertised surface come apart when you install a **tool selector**. The engine consults it once per turn and threads the chosen schemas into both the request you send and the window estimate.

Your small models stop seeing fifty schemas at once, and the estimate counts what the wire carries. See [tool selection](/core-data/tool-selection/).

The engine sends `all_schemas()` with every model request. It classifies model replies against `tool_names()`, so a call to a name that was never advertised is answered with "tool 'x' is not available" before any dispatch happens. See [tool dispatch](/engine/tool-dispatch/).

One ordering fact is pinned by the [golden request bytes](/integration/testing/) harness, so treat it as an API promise. `all_tools()` and `all_schemas()` both return registration order, and a re-registered name keeps its original slot. `tool_names()` returns alphabetical order. Deterministic schema order is what makes request construction byte-reproducible.

## Built-in tools

The crate ships five families of ready-made tools behind four feature flags. You construct each one and register it by hand. Nothing is auto-installed, and `default = []` is unchanged:

| Family | Feature | Tools | Deep dive |
|---|---|---|---|
| Planning | `builtin_tools` | `Think`, the no-side-effect scratchpad | — |
| Reading | `builtin_tools` | `Read`, line-aware reads over a pluggable `ContentSource` | [read tooling](/file-reference/tool-builtin-read/) |
| Filesystem | `fs_tools` | `Write`, `Edit`, `MultiEdit`, `FileViewer`, plus `FileSource` | [fs family](/file-reference/tool-builtin-fs/) |
| Search | `search_tools` | `Glob`, `Grep`, `CodeSearch`, `Tree`, plus `FsSearchSource` | [search family](/file-reference/tool-builtin-search/) |
| Shell | `shell_tools` | `Shell`, `Jobs`, plus `UnixShellBackend` | [shell family](/file-reference/tool-builtin-shell/) |

Wire names are CamelCase, and this was a breaking change in 0.4.0. Every builtin registers as `Read`, `Think`, `Write`, `Edit`, `MultiEdit`, `FileViewer`, `Glob`, `Grep`, `CodeSearch`, `Tree`, `Shell`, or `Jobs`.

That matches the naming convention models see in other agent tools. If you wrote gate rules or prompts against the old lowercase names, they need updating.

### ThinkTool

ThinkTool is the planning scratchpad. It advertises exactly one field: `think(thought)`, which returns the constant reply `"ok"`.

An acknowledgement is not the point. The thought is already in the conversation, so echoing it back would double its token cost.

The description is the point. It is written as an instruction template: restate the goal, list the options, check the plan, decide. This tool teaches the procedure, which on small local models is the cheap version of thinking before you act.

Three more facts about the built-ins:

- `is_read_only()` and `is_concurrency_safe()` are `true` for the read-only families by definition. The shell family gates concurrency per command through a read-only allowlist, covered in the [shell family page](/file-reference/tool-builtin-shell/).
- A missing field or a wrong-typed field is a `ToolError::InvalidInput` naming the field and its expected type. You never get a silent default.
- Registration is the only way any of them enters a session.
- The fs family accepts the path-key spellings your model actually sends, `path` where `file_path` was expected and back, with canonical precedence and errors naming what arrived (0.4.1). See the [fs family page](/file-reference/tool-builtin-fs/).

## Schema rules

The framework does not validate your schema, so a broken schema means the model sends broken arguments. Test yours against a real run before you ship it.

Two places do check. With `ToolConstraint::Strict`, covered in [structured output](/integration/structured-output/), loopctl tightens schemas automatically: every object becomes closed with `additionalProperties: false`, and every property becomes required. That is the shape strict-mode APIs demand.

Gotcha: under the MCP server adapter, [MCP](/integration/mcp/) validates schemas with a real JSON Schema validator before advertising them. A tool with an invalid schema is skipped with a warning.

## Related pages

- [Tool dispatch](/engine/tool-dispatch/) is where the wrapping of each call is explained.
- [Tool selection](/core-data/tool-selection/) covers advertising a subset each turn.
- [Middleware](/safety/middleware/) covers timeouts, caching, and permissions as stackable layers.
- [The derive macro](/integration/derive-macro/) explains every attribute.
- [File reference: tool.rs](/file-reference/tool/)
