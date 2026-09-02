# `src/middleware/redaction.rs` — `RedactingMiddleware` [feature: redaction]

Scrubs secrets from tool output before anything else sees them.

**Key items**

- `RedactingMiddleware::new(SecretPatternSet)`.
- `SecretPatternSet::default_common()` — named regex patterns: `bearer`, `api_key_kv`, `aws_access_key`, `pem_private_key`, `github_pat`, `gitlab_pat`; `with_pattern(SecretPattern)` appends; `with_entropy_heuristic(false)` disables the heuristic.
- Entropy heuristic: ≥32-char tokens with ≥4.5 bits/byte randomness → `[REDACTED:high_entropy]` (hex hashes top out at 4.0 — stay visible).

**Behavior notes**

- Replacement shape: `[REDACTED:<kind>]` per match; `scrub` returns the count for observability.
- Post-execution only: rewrites text parts (multipart included), never touches images, never sets `is_error`, preserves display hints — zero effect on loop semantics.
- Register it **outer** (before verifiers) so it also scrubs what inner layers append.

Deep dive: [Middleware](../03-safety/01-middleware.md).
