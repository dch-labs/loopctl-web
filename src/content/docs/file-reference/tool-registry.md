---
title: "src/tool/registry.rs"
---

This file is your name-to-tool phone book, plus the function adapter you reach for when a quick tool deserves no struct of its own.

## Key items

Your `ToolRegistry` gives you `register`, where a repeated name overwrites the old tool with a warn and keeps the original position. It also gives you `get`, `contains`, and `tool_names`, which returns sorted names.

`all_schemas` returns registration order since 0.4.0, and that stability is what makes your request construction byte-reproducible for the goldens.

`all_tools` also follows registration order and includes unsafe tools, while `concurrent_safe_tools` filters them. You finish with `len` and `is_empty`.

The registry is `Send + Sync`, so share it as an `Arc`.

`FnTool` exposes public fields plus a builder: `new(name, description, schema, tool_fn)`, `.concurrency_safe()`, `.with_concurrency_check(fn)`, `.with_resource_key(fn)`, `.read_only()`, and `.with_system_prompt(...)`.

## Behavior notes

Your engine advertises `all_schemas()` to the model and classifies replies against `tool_names()`. Unknown names are pre-answered "not available" without dispatch.

There is no iteration trait here. Call `all_tools()` when you need every entry.

`FnTool`'s per-input concurrency check overrides the static flag whenever one is present.

Deep dive: [Tools](/core-data/tools/).
