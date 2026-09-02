---
title: "`src/stream/handler.rs` — `StreamHandler` [feature: streaming]"
---


The resilience wrapper around every streaming turn: retries, three timeout guards, rate-limit ladder, and non-streaming rescue. (~7,200 lines — the largest file in the crate, mostly tests.)

**Key items**

- `StreamHandler::new()` — production defaults; `passthrough()` — no resilience; builders `with_timeout_config` / `with_retry_config` / `with_rate_limit_config` / `with_rate_limiter` / `with_rate_limit_max_wait`.
- `stream_turn(client, request, options, cancel)` — yields `HandlerEvent`: `Stream(event)`, `AttemptReset`, `Fallback { message, ... }`.
- `StreamOutcome` — `Completed`, `TotalTimeout`, `EventTimeout`, `RateLimited`, `InitFailed` (historical name; also covers mid-stream failures and truncation), `FallbackToNonStreaming`, `Cancelled`.
- `StreamHandlerError` — including `RateLimitEscalation` (escalate to the model breaker, not the same-model fallback).
- Config defaults: initial event timeout 2 min, per-event 3 min, total 5 min, 10 consecutive timeouts (2 for empty streams); transport retries 3 (100ms base, 10s cap, ±10% jitter); rate-limit retries 5 hard / escalate after 3, `Retry-After` honored up to 1 min; rate-limiter wait cap 30s.

**Behavior notes**

- Truncated streams (no terminal event) are retried, not reported complete. Permanent errors (401/404) never retry. Rate-limit escalation and transport budgets are independent.
- `has_partial_data` means "at least one flushed part" — deltas without a part-stop don't count as salvageable.
- Everything is cancel-aware, including backoff sleeps and the fallback request.

Deep dive: [Stream events](/core-data/stream-events/).
