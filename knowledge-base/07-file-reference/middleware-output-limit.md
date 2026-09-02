# `src/middleware/output_limit.rs` — `OutputLimitMiddleware`

A hard cap on how much text a tool may return to the model.

**Key items**

- `OutputLimitMiddleware::new(max_chars)` — explicit limit; `new(0)` disables the layer entirely (the zero-disables convention).

**Behavior notes**

- **Character-based, never byte-based** — truncation lands on `char` boundaries (multi-byte scripts are safe); the marker `\n[truncated]` is reserved inside the budget.
- Keeps the **head** of the text; exact-at-limit passes through unchanged (strictly-greater comparison).
- Multipart outputs share **one budget across text parts**, in order; images pass through untouched; the parts array is never resized.
- Error text is also subject to the cap; `duration` and `resolved_tool_name` preserved; never sets `is_error`.

Deep dive: [Middleware](../03-safety/01-middleware.md).
