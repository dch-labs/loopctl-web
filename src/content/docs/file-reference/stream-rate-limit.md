---
title: "src/stream/rate_limit.rs"
---

This file is your proactive rate limiter: it waits before you fire into a throttled endpoint, instead of only reacting to 429s.

## Key items

`TokenBucket::new(capacity)` sets your burst to capacity and refills continuously at `capacity/60` tokens per second. Refill is lazy on access, so you run no background task.

`take()` and `take_at(instant)` consume one token and return `Ok(())`, or `Err(RateLimitError::Wait(duration))` telling you the time until a token refills, with `Duration::MAX` for zero-refill buckets, or `Err(Poisoned)`.

`available()` and `available_at()` run your queries without consuming a token.

`RateLimiter::new(requests_per_minute)` disables at `0` and keeps one bucket per base URL, lazily created and shared.

## Behavior notes

Your provider identity is the base URL, so OpenAI and Ollama get independent buckets while two clients on one endpoint share theirs.

The handler's `gate_on_rate_limit` sleeps in slices bounded by `rate_limit_max_wait`, default 30s, and then proceeds anyway. Risking a 429 beats hanging your run.

Reactive throttling, which honors 429 responses, lives in the handler's retry ladder. This module is its proactive complement.

Deep dive: [Stream events](/core-data/stream-events/).
