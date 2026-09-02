---
title: "`src/stream/rate_limit.rs` — the token bucket"
---


The proactive rate limiter: wait *before* firing into a throttled endpoint, instead of only reacting to 429s.

**Key items**

- `TokenBucket::new(capacity)` — burst = capacity; continuous refill at `capacity/60` tokens per second; lazy refill on access (no background task).
- `take()` / `take_at(instant)` — consume one token → `Ok(())` or `Err(RateLimitError::Wait(duration))` (time until a token refills; `Duration::MAX` for zero-refill buckets) or `Err(Poisoned)`.
- `available()` / `available_at()` — non-consuming queries.
- `RateLimiter::new(requests_per_minute)` — `0` disables; one bucket per base URL (lazily created, shared).

**Behavior notes**

- Provider identity is the base URL: OpenAI and Ollama get independent buckets; two clients on one endpoint share.
- The handler's `gate_on_rate_limit` sleeps in slices bounded by `rate_limit_max_wait` (30s default) and then **proceeds anyway** — better to risk a 429 than hang.
- Reactive throttling (honoring 429 responses) lives in the handler's retry ladder; this module is the proactive complement.

Deep dive: [Stream events](/core-data/stream-events/).
