# `src/tool/registry.rs` — `ToolRegistry` and `FnTool`

The name→tool phone book, plus the function-adapter for quick tools. Runtime-mutable since 0.4.1.

**Key items**

- `ToolRegistry` — `register(&self, ...)` (same name **overwrites** with a warn, original position kept; `&mut self` relaxed to `&self` in 0.4.1), `remove(&self, name)` (idempotent no-op on an unknown name), `version() -> u64` (monotonic, bumped under the write lock), `versioned_surface() -> (u64, Vec<ToolSchema>)` (the registry-atomic pair), `registration_matches(name, schema)` (schema-equality identity read), `get` (owned `Option<Arc<dyn Tool>>`), `contains`, `tool_names` (sorted), `all_schemas` (registration order since 0.4.0 — what makes request construction byte-reproducible for the goldens), `all_tools`/`concurrent_safe_tools` (`Vec<Arc<dyn Tool>>`), `len`/`is_empty`. `Send + Sync` — share as `Arc`; `BareLoop::tool_registry()` hands out the handle.
- `FnTool` — public fields + builder: `new(name, description, schema, tool_fn)`, `.concurrency_safe()`, `.with_concurrency_check(fn)`, `.with_resource_key(fn)`, `.read_only()`, `.with_system_prompt(...)`.

**Behavior notes**

- The registry's tool set lives behind an interior lock: registration is advertisement-immediate (the next turn's request carries it), removal is execution-draining (an in-flight call completes against its owned handle; the next call fails the typed unknown-tool path).
- Every mutation bumps `version`, which the engine watches twice: the cached overhead reservation re-measures on a move, and turn preparation reads `versioned_surface()` as one pair to report `on_tool_surface_changed` with the name-sorted diff.
- The engine advertises the selected schemas to the model and classifies replies against `tool_names()`; unknown names are pre-answered "not available" without dispatch.
- No iteration trait — use `all_tools()`.
- `FnTool`'s per-input concurrency check overrides the static flag when present.

Deep dive: [Tools](../01-core-data/02-tools.md) · [Tool selection](../01-core-data/07-tool-selection.md).
