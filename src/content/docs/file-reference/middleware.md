---
title: "src/middleware.rs"
---

This file holds your middleware trait, the dispatch context and result carriers, and the pipeline builder. The layers themselves live in `middleware/*.rs`.

## Key items

`ToolMiddleware` asks for `name()` plus `dispatch(ctx, next)` as a boxed async method, so you can pre-process, call `next`, post-process, or short-circuit.

`ToolDispatchContext { tool_name, input, call_id, turn_number, cancel, permission, tool_context }` carries everything a layer may read or rewrite.

`ToolPipeline` is a cursor-based chain where registration order equals execution order, so the first layer you register sits outermost. It offers `invoke(ctx)`, `dispatch_all` which is all-or-nothing on cancel, and `middleware_names()`.

`ToolPipelineBuilder` gives you `with_middleware`, `with_middleware_arc`, `with_core(registry)`, and `build()`, failing with `PipelineError { Empty, MissingCore }`.

The module re-exports every shipped layer plus `ToolDispatchResult`, which is defined in `tool.rs`.

## Behavior notes

Your core, `ToolCallMiddleware` in `tool_call.rs`, is always innermost. That is where the registry lookup and the actual tool call happen.

On the engine path, `agent.set_pipeline(builder)` injects the loop's registry as the core, so do not call `with_core` yourself there.

Order guidance: keep permission outermost so deny happens before work, place redaction before verifiers, and put the shield inside renamers and outside memoize.

Deep dive: [Middleware](/safety/middleware/).
