# `src/api/error.rs` — `ApiError` and `ErrorCode`

Provider-level errors with the classification logic every retry decision builds on.

**Key items**

- `ApiError` — `Api`, `RateLimit { retry_after, message }`, `Auth`, `Http`, `Json`, `Io`, `Tool`, `Config`, `Interrupted`, `Other`; constructors for each (`http_with_status`, `rate_limited`, `auth_invalid_key`, ...).
- `ErrorCode` — stable numeric codes (1000s API, 1100s auth, 1200s HTTP, 1300s tool, 1400s config, 1500s IO, 1600 JSON, 1700 internal, 1999 interrupted).
- `is_retryable()` — true for connection errors, 5xx, 408/429, rate limits, timeouts; false for auth and other 4xx.
- `is_rate_limited()` — 429/503/529 in any shape.
- `is_context_overflow()` — broad substring match over "context" / "too many tokens" / "exceeds maximum" / "max tokens" (deliberate: false positives route through compaction, which is the right recovery anyway).
- `parse_retry_after` — RFC 9110 `Retry-After` (seconds or HTTP-date).

**Behavior notes**

- `RateLimit.retry_after` arrives pre-parsed so downstream layers never re-parse.
- Error classification often keys off message text — when wrapping provider errors, preserve their wording or use the typed constructors.

Deep dive: [API client](../01-core-data/03-api-client.md).
