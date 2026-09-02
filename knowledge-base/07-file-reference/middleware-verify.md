# `src/middleware/verify.rs` — `VerifyMiddleware`

Runs your verifier after write-class tools succeed and appends the verdict — "verify-on-write" made automatic.

**Key items**

- `Verifier::verify(ctx, tool_name) -> VerifyResult { passed, diagnostics }` — async, boxed like `Tool::call`; `NoopVerifier` is the do-nothing default.
- `VerifyMiddleware::new(verifier, write_tools)` — exact-match names.

**Behavior notes**

- Matches on the **resolved** (post-rename) tool name — the same key space as the engine's health recording.
- Appends `"\n\n[verify] passed|failed: <diagnostics>"`; **never sets `is_error`** — a failed verify on a successful write stays a success; the model reads and decides.
- Skipped entirely on tool errors (the tool's own `is_error` preserved).
- Cap interaction: with an outer `OutputLimitMiddleware`, a verify block on output that already fills the cap is truncated away — size the cap with headroom, or observe the verdict from a middleware registered *between* cap and verify.
- Registered outside memoize: cache hits are still verified (the cache never holds a verify block).

Deep dive: [Middleware](../03-safety/01-middleware.md).
