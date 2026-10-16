---
title: "src/api/error.rs"
---

This file carries your provider-level errors plus the classification logic every retry decision builds on.

## Key items

Your `ApiError` variants are `Api`, `RateLimit { retry_after, message }`, `Auth`, `Http`, `Json`, `Io`, `Tool`, `Config`, `Interrupted`, and `Other`.

Each has a constructor, such as `http_with_status`, `rate_limited`, and `auth_invalid_key`.

`ErrorCode` holds stable numeric codes: 1000s API, 1100s auth, 1200s HTTP, 1300s tool, 1400s config, 1500s IO, 1600 JSON, 1700 internal, and 1999 interrupted.

`is_retryable()` returns true for connection errors, 5xx, 408 and 429, rate limits, and timeouts. It returns false for auth and other 4xx.

`is_rate_limited()` catches 429, 503, and 529 in any shape.

`is_context_overflow()` runs a broad substring match over "context", "too many tokens", "exceeds maximum", and "max tokens". That breadth is deliberate: false positives route through compaction, which is the right recovery anyway.

`parse_retry_after` reads RFC 9110 `Retry-After` as seconds or an HTTP-date.

## Behavior notes

`RateLimit.retry_after` arrives pre-parsed, so your downstream layers never re-parse it.

Error classification often keys off message text, so when you wrap provider errors, preserve their wording or use the typed constructors.

Deep dive: [API client](/core-data/api-client/).
