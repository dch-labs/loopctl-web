---
title: "src/tool/registry.rs"
---

This file is your name-to-tool phone book, plus the function adapter you reach for when a quick tool deserves no struct of its own. It is runtime-mutable since 0.4.1.

## Key items

Your `ToolRegistry` gives you `register`, where a repeated name overwrites the old tool with a warn and keeps the original position. Since 0.4.1 it takes `&self`, so your existing call sites compile unchanged.

Call `remove(&self, name)` to drop a tool. It is an idempotent no-op on an unknown name. Read `version()` for the monotonic counter every mutation bumps, and `versioned_surface()` for the surface and its version as one registry-atomic pair. Use `registration_matches(name, schema)` when you need the schema-equality identity read.

It also gives you `get`, which returns an owned `Option<Arc<dyn Tool>>` since 0.4.1, plus `contains` and `tool_names`, which returns sorted names.

`all_schemas` returns registration order since 0.4.0, and that stability is what makes your request construction byte-reproducible for the goldens.

`all_tools` also follows registration order and includes unsafe tools, while `concurrent_safe_tools` filters them. You finish with `len` and `is_empty`.

The registry is `Send + Sync`, so share it as an `Arc`. `BareLoop::tool_registry()` hands you that handle.

`FnTool` exposes public fields plus a builder: `new(name, description, schema, tool_fn)`, `.concurrency_safe()`, `.with_concurrency_check(fn)`, `.with_resource_key(fn)`, `.read_only()`, and `.with_system_prompt(...)`.

## Behavior notes

Your tool set lives behind an interior lock, so you can mutate while a run is in flight. Registration is advertisement-immediate: the next turn's request carries your tool. Removal is execution-draining: an in-flight call completes against its owned handle, and the next call fails the typed unknown-tool path.

Every mutation bumps `version`, which your engine watches twice. The cached overhead reservation re-measures on a move, and turn preparation reads `versioned_surface()` as one pair to report `on_tool_surface_changed` with the name-sorted diff.

Your engine advertises the selected schemas to the model and classifies replies against `tool_names()`. Unknown names are pre-answered "not available" without dispatch.

There is no iteration trait here. Call `all_tools()` when you need every entry.

`FnTool`'s per-input concurrency check overrides the static flag whenever one is present.

Deep dive: [Tools](/core-data/tools/) and [tool selection](/core-data/tool-selection/).
