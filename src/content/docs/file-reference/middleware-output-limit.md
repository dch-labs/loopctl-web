---
title: "src/middleware/output_limit.rs"
---

This file puts a hard cap on how much text a tool may return to your model. Install it when one verbose tool could otherwise flood your whole context.

## Key items

You build it with `OutputLimitMiddleware::new(max_chars)`, which states your limit explicitly. Passing `new(0)` disables the layer entirely, following the zero-disables convention.

## Behavior notes

Counting is character-based, never byte-based, so truncation lands on `char` boundaries and multi-byte scripts stay safe. The marker `\n[truncated]` is reserved inside your budget.

You keep the head of the text, and text exactly at your limit passes through unchanged because the comparison is strictly-greater.

Multipart outputs share one budget across text parts, in order. Images pass through untouched, and the parts array is never resized.

Error text is also subject to your cap. Duration and `resolved_tool_name` survive untouched, and this layer never sets `is_error`.

Deep dive: [Middleware](/safety/middleware/).
