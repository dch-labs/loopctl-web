---
title: "src/middleware/timeout.rs"
---

This file gives you `TimeoutMiddleware`, a per-call deadline around everything inside it. Place it outside the tools you cannot trust to finish.

## Key items

Your `TimeoutConfig` ships `timeout: 2 min`, `retry_on_timeout: false`, and `max_retries: 0`.

Constructors: `new(config)`, `from_secs(u64)` when you want the default retry settings kept, and `none()` for a pass-through layer.

## Behavior notes

On timeout you get the soft error `"Tool 'x' timed out after Ns"`. The in-flight future is dropped, so no partial output reaches your model.

The reported `duration` is the configured deadline that expired, not wall time, which keeps your health statistics honest.

With retries enabled your deadline doubles per attempt, so total attempts equal `1 + max_retries`.

Your wait races the cancel signal, and cancellation beats the clock.

Mutate nothing in the context. On success this layer preserves the inner result untouched.

Deep dive: [Middleware](/safety/middleware/).
