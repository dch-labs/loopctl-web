# `src/middleware/tool_call.rs` — the pipeline core layer

The innermost middleware: performs the registry lookup and runs the tool. No `next` — it is the end of the chain.

**Key items**

- `ToolCallMiddleware::new(registry)` — stored as `Arc<ToolRegistry>`; name `"tool_call"`.

**Behavior notes**

- Registry miss → soft error `Tool not found: x. Available: ...` (the shape `UnknownToolMiddleware` detects to append suggestions).
- Panic containment: `AssertUnwindSafe(tool.call(...)).catch_unwind()` raced against cancel; a panic becomes a soft error naming the tool and message — the pipeline never hard-fails from a tool panic.
- Cancellation observed *here* becomes a soft `"tool 'x' cancelled"` result — but the engine's biased cancel-vs-dispatch select usually wins first and surfaces the hard `LoopError::Cancelled`.

Deep dive: [Middleware](../03-safety/01-middleware.md).
