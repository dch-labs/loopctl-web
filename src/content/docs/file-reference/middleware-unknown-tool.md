---
title: "src/middleware/unknown_tool.rs"
---

This file turns your bare "tool not found" errors into teachable moments, so the model reads `"Tool not found: redd_file. Available: ... Did you mean 'read_file'?"` and corrects itself.

## Key items

You install it with `UnknownToolMiddleware::new(registry)`, which ships a 0.4 threshold, or with `with_threshold(0.0..=1.0)` when you want a stricter match.

`similarity(a, b) -> f64` is your public static scorer. It measures an LCS-based ratio, then adds a prefix bonus, and it returns the score to you.

## Behavior notes

Detection is deliberately specific. Your middleware acts only on a single text part that is `is_error` and contains both "not found" and "tool", so "file not found" never triggers it.

The suggestion lookup reads the post-dispatch `ctx.tool_name`, which stays correct even behind renaming middleware, and a test pins that.

Ties break lexicographically, so your suggestions stay deterministic and order-independent. Trust that ordering when you compare two runs.

Names your model was never shown are pre-answered by the engine and never dispatched, so they never reach this layer. Read the suggestion text as advice, not as a guarantee that the tool exists.

Deep dive: [Middleware](/safety/middleware/).
