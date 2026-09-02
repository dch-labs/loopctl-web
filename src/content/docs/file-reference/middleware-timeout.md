---
title: "`src/middleware/timeout.rs` — `TimeoutMiddleware`"
---


A per-call deadline around everything inside it.

**Key items**

- `TimeoutConfig { timeout: 2 min, retry_on_timeout: false, max_retries: 0 }`.
- Constructors: `new(config)`, `from_secs(u64)` (keeps default retry settings), `none()` (pass-through).

**Behavior notes**

- On timeout: soft error `"Tool 'x' timed out after Ns"` — the in-flight future is dropped, no partial output; the reported `duration` is the configured deadline that expired, not wall time.
- With retries enabled the deadline **doubles** per attempt; total attempts = `1 + max_retries`.
- The wait races the cancel signal — cancellation beats the clock.
- Mutates nothing in the context; preserves the inner result untouched on success.

Deep dive: [Middleware](/safety/middleware/).
