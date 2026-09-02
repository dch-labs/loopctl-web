---
title: "`src/tool/registry.rs` — `ToolRegistry` and `FnTool`"
---


The name→tool phone book, plus the function-adapter for quick tools.

**Key items**

- `ToolRegistry` — `register` (same name **overwrites** with a warn, original position kept), `get`, `contains`, `tool_names` (sorted), `all_schemas` (order unspecified), `all_tools` (registration order, includes unsafe), `concurrent_safe_tools`, `len`/`is_empty`. `Send + Sync` — share as `Arc`.
- `FnTool` — public fields + builder: `new(name, description, schema, tool_fn)`, `.concurrency_safe()`, `.with_concurrency_check(fn)`, `.with_resource_key(fn)`, `.read_only()`, `.with_system_prompt(...)`.

**Behavior notes**

- The engine advertises `all_schemas()` to the model and classifies replies against `tool_names()`; unknown names are pre-answered "not available" without dispatch.
- No iteration trait — use `all_tools()`.
- `FnTool`'s per-input concurrency check overrides the static flag when present.

Deep dive: [Tools](/core-data/tools/).
