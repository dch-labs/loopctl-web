---
title: "`src/middleware/unknown_tool.rs` — `UnknownToolMiddleware`"
---


Turns bare "tool not found" errors into teachable moments: `"Tool not found: redd_file. Available: ... Did you mean 'read_file'?"`

**Key items**

- `UnknownToolMiddleware::new(registry)` (threshold 0.4) / `with_threshold(0.0..=1.0)`.
- `similarity(a, b) -> f64` — LCS-based + prefix bonus, public static.

**Behavior notes**

- Detection is deliberately specific: single text part, `is_error`, containing **both** "not found" and "tool" — so "file not found" never triggers it.
- The suggestion lookup uses the **post-dispatch** `ctx.tool_name` — correct even behind renaming middleware (pinned by test).
- Ties break lexicographically — deterministic and order-independent.
- Names the model was never shown are pre-answered by the engine (never dispatched) and never reach this layer.

Deep dive: [Middleware](/safety/middleware/).
