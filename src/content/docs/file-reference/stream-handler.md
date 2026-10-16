---
title: "src/stream/handler.rs"
---

This file is your resilience wrapper around every streaming turn under the `streaming` feature: retries, three timeout guards, a rate-limit ladder, and non-streaming rescue.

It runs about 7,200 lines, which makes it the largest file in the crate, mostly tests.

## Key items

`StreamHandler::new()` gives you production defaults, and `passthrough()` gives you no resilience. Your builders are `with_timeout_config`, `with_retry_config`, `with_rate_limit_config`, `with_rate_limiter`, and `with_rate_limit_max_wait`.

`stream_turn(client, request, options, cancel)` yields `HandlerEvent`: `Stream(event)`, `AttemptReset`, or `Fallback { message, ... }`.

`StreamOutcome` covers `Completed`, `TotalTimeout`, `EventTimeout`, `RateLimited`, `InitFailed`, `FallbackToNonStreaming`, and `Cancelled`. That fifth name is historical and also covers mid-stream failures and truncation.

`StreamHandlerError` includes `RateLimitEscalation`, which escalates to your model breaker rather than same-model fallback.

Config defaults: initial event timeout 2 min, per-event 3 min, total 5 min, and 10 consecutive timeouts, or 2 for empty streams.

Transport retries are 3 at 100ms base, 10s cap, and ±10% jitter. Rate-limit retries are 5 hard, escalate after 3, and `Retry-After` is honored up to 1 min. Your rate-limiter wait cap is 30s.

## Behavior notes

Truncated streams, meaning no terminal event, are retried, not reported complete. Permanent errors like 401 and 404 never retry.

Your rate-limit escalation and transport budgets are independent, so one does not eat the other.

`has_partial_data` means at least one flushed part, so deltas without a part-stop do not count as salvageable.

Everything here is cancel-aware, including your backoff sleeps and the fallback request.

Deep dive: [Stream events](/core-data/stream-events/).
