---
title: "src/tool/builtin.rs and src/tool/builtin/think.rs"
---

This file is the home for tools the crate ships itself. The module exists only to be registered, so nothing is auto-installed and `default = []` is unchanged.

The family has grown, see the [families table](/core-data/tools/#built-in-tools), and this page's resident is the planning scratchpad.

## Key items

`ThinkTool` is a no-side-effect scratchpad: `think(thought)` returns the constant `"ok"`. It registers as `Think`, in CamelCase since 0.4.0.

Both `is_read_only()` and `is_concurrency_safe()` are true by definition.

The description is an instruction template: restate the goal, list the options, check the plan against the constraints, decide. So the tool teaches the procedure, not only the name.

That is its whole value on small models: your model's reasoning is forced into the open transcript where you can read it.

A missing or wrong-typed `thought` yields a `ToolError::InvalidInput` naming the field and its expected type.

The acknowledgement is constant because your thought is already in the conversation as the call's input, and echoing it would double its token cost.

## Behavior notes

Registration is your only entry point: `registry.register(ThinkTool)`, see [tools](/core-data/tools/).

Your tool keeps no state, touches no filesystem, and opens no network, so you can place it in any pipeline position and run it under parallel dispatch.

The tool still emits its own `loopctl.think.calls` counter, shipped 0.3.1 and deprecated in 0.4.0 as redundant double-counting, since the engine-level `loopctl.tools.calls` already counts every Think call.

It is kept for the released metric surface and slated for removal in a later `0.Y.0`.

Deep dive: [Built-in tools](/core-data/tools/#built-in-tools) · [File reference: tool.rs](/file-reference/tool/).
