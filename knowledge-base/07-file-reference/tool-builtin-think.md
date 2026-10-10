# `src/tool/builtin.rs` + `src/tool/builtin/think.rs` — `ThinkTool`

The home for tools the crate ships itself. The module exists only to be registered — nothing is auto-installed, and `default = []` is unchanged. The family has grown (see the [families table](../01-core-data/02-tools.md#built-in-tools--four-families-explicit-registration)); this page's resident is the planning scratchpad.

**Key items**

- `ThinkTool` — a no-side-effect scratchpad: `think(thought)` → the constant `"ok"`. Registers as **`Think`** (CamelCase since 0.4.0). `is_read_only()` and `is_concurrency_safe()` are `true` by definition.
- The **description is an instruction template** — restate the goal, list the options, check the plan against the constraints, decide — so the tool teaches the procedure, not just the name. That is its whole value on small models: reasoning forced into the open transcript.
- A missing or wrong-typed `thought` is a `ToolError::InvalidInput` naming the field and its expected type.
- The acknowledgement is constant because the thought is already in the conversation as the call's input — echoing it would double its token cost.

**Behavior notes**

- Registration is the only entry: `registry.register(ThinkTool)` — see [tools](../01-core-data/02-tools.md).
- No state, no filesystem, no network — safe in any pipeline position and under parallel dispatch.
- The tool still emits its own `loopctl.think.calls` counter (shipped 0.3.1) — **deprecated in 0.4.0** as redundant double-counting, since the engine-level `loopctl.tools.calls` already counts every Think call. Kept for the released metric surface; slated for removal in a later `0.Y.0`.

Deep dive: [Built-in tools](../01-core-data/02-tools.md#built-in-tools--four-families-explicit-registration) · [File reference: tool.rs](tool.md).
