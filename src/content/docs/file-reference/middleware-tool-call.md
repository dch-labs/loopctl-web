---
title: "src/middleware/tool_call.rs"
---

This file is your innermost middleware: it performs the registry lookup and runs the tool. There is no `next` here, because this is the end of your chain.

## Key items

You build it with `ToolCallMiddleware::new(registry)`, which stores an `Arc<ToolRegistry>` and registers under the name `"tool_call"`.

## Behavior notes

A registry miss becomes the soft error `Tool not found: x. Available: ...`, which is the exact shape `UnknownToolMiddleware` detects in order to append suggestions.

Panic containment wraps the call as `AssertUnwindSafe(tool.call(...)).catch_unwind()`, raced against your cancel signal. A panic becomes a soft error naming the tool and message, so your pipeline never hard-fails from a tool panic.

Cancellation observed here becomes the soft result `"tool 'x' cancelled"`. In practice your engine's biased cancel-vs-dispatch select usually wins first and surfaces the hard `LoopError::Cancelled`.

Deep dive: [Middleware](/safety/middleware/).
