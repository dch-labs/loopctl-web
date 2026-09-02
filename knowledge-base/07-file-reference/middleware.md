# `src/middleware.rs` — the pipeline core

The middleware trait, the dispatch context/result carriers, and the pipeline builder. The layers themselves live in `middleware/*.rs`.

**Key items**

- `ToolMiddleware` — `name()` + `dispatch(ctx, next)` (boxed async); pre-process, call `next`, post-process — or short-circuit.
- `ToolDispatchContext { tool_name, input, call_id, turn_number, cancel, permission, tool_context }` — everything a layer may read or rewrite.
- `ToolPipeline` — cursor-based chain; **registration order = execution order**, first registered outermost; `invoke(ctx)`, `dispatch_all` (all-or-nothing on cancel), `middleware_names()`.
- `ToolPipelineBuilder` — `with_middleware`, `with_middleware_arc`, `with_core(registry)`, `build()`; `PipelineError { Empty, MissingCore }`.
- Re-exports every shipped layer and `ToolDispatchResult` (defined in `tool.rs`).

**Behavior notes**

- The core (`ToolCallMiddleware`, in `tool_call.rs`) is always innermost — the registry lookup and the actual tool call.
- The engine path: `agent.set_pipeline(builder)` injects the loop's registry as the core — don't call `with_core` yourself there.
- Ordering guidance: permission outermost (deny before work), redaction before verifiers, the shield inside renamers and outside memoize.

Deep dive: [Middleware](../03-safety/01-middleware.md).
