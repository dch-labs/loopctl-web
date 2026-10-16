---
title: "src/middleware/shield.rs"
---

This file holds your pipeline wiring for tool safety shields, under the `tool_shield` feature. Read it before you decide where the shield sits in your chain, because position changes what it can see.

## Key items

You install it with `SafetyShieldMiddleware::new(shield: Arc<dyn ToolSafetyShield>)`, which registers under the name `"safety_shield"`.

It maintains your last-20 watched-calls window, and that window becomes `ShieldContext::recent_calls` when the shield runs.

## Behavior notes

A `Block` verdict reaches your model as the soft error `"blocked by safety shield: <reason>"` with zero duration, so your run continues.

A `Warn` verdict logs a tracing warning and lets your call proceed, and an `Allow` verdict simply proceeds.

Every admitted watched call is recorded through `shield.record_invocation`, so your shield can score repetition. Blocked attempts never enter that record.

An inner cache-served repeat still counts, because you sit before the cache.

Your install order carries three rules: place it after renaming middleware so it evaluates the executed name, and before memoize so it scores repetitions even on cache hits, exactly once.

Repeated blocks count as failures toward your tool's breaker. Once the breaker opens, the engine's gate refuses first and your model sees "temporarily unavailable".

Leave your watched set empty and you skip this middleware entirely, at no cost.

Deep dive: [The shield](/safety/tool-shield/).
