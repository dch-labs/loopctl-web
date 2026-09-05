# `src/tool/builtin.rs` + `src/tool/builtin/think.rs` — the built-in tools

The home for tools the crate ships itself, behind the `builtin_tools` feature. The module exists only to be registered — nothing is auto-installed, and `default = []` is unchanged. First resident: `ThinkTool`.

**Key items**

- `ThinkTool` — a no-side-effect scratchpad: `think(thought)` → the constant `"ok"`. `is_read_only()` and `is_concurrency_safe()` are `true` by definition.
- The **description is an instruction template** — restate the goal, list the options, check the plan against the constraints, decide — so the tool teaches the procedure, not just the name. That is its whole value on small models: reasoning forced into the open transcript.
- A missing or non-string `thought` is a `ToolError::InvalidInput` naming the field.
- The acknowledgement is constant because the thought is already in the conversation as the call's input — echoing it would double its token cost.

**Behavior notes**

- Registration is the only entry: `registry.register(ThinkTool)` — see [tools](../01-core-data/02-tools.md).
- No state, no filesystem, no network — safe in any pipeline position and under parallel dispatch.

Deep dive: [Built-in tools](../01-core-data/02-tools.md#built-in-tools--thinktool) · [File reference: tool.rs](tool.md).
