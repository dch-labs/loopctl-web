---
title: "`src/middleware/shield.rs` — `SafetyShieldMiddleware` [feature: tool_shield]"
---


The pipeline wiring for tool safety shields.

**Key items**

- `SafetyShieldMiddleware::new(shield: Arc<dyn ToolSafetyShield>)` — name `"safety_shield"`; maintains the last-20 watched-calls window that becomes `ShieldContext::recent_calls`.

**Behavior notes**

- `Block` → soft error `"blocked by safety shield: <reason>"`, zero duration — run continues. `Warn` → tracing warning, call proceeds. `Allow` → proceed.
- Every admitted watched call is recorded via `shield.record_invocation` (blocked attempts never are; an inner cache-served repeat still is).
- Install order: **after** renaming middleware (evaluate the executed name), **before** memoize (score repetitions even on cache hits), **exactly once**.
- Repeated blocks count as failures toward the tool's breaker — once open, the engine's gate refuses first and the model sees "temporarily unavailable".
- An empty watched set skips the middleware entirely.

Deep dive: [The shield](/safety/tool-shield/).
