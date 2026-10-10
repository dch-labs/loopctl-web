---
title: "`src/middleware/verify.rs` + `verify/builtin.rs` — `VerifyMiddleware`"
---


Runs your verifier after write-class tools succeed and appends the verdict — "verify-on-write" made automatic. Since 0.4.0 the module ships a **real builtin**: `CommandVerifier` (in `verify/builtin.rs`) judges write-class calls statically — a deny-glob check on shell commands (`rm -rf /` in any spacing, at token boundaries; wrapped `sh -c "…"` must name an allowed shell and the inner command is checked) and a target-path check on write inputs (parent exists and is writable) — with one-line diagnostics written for a small-model reader.

**Key items**

- `Verifier::verify(ctx, tool_name) -> VerifyResult { passed, diagnostics }` — async, boxed like `Tool::call`; `NoopVerifier` is the explicit opt-out.
- `VerifyMiddleware::new(verifier, write_tools)` — exact-match names.
- `CommandVerifier::new()` (+ `with_deny_globs`, `with_allowed_shells`) and `WritePathExtractor` — the builtins the default pipeline wires since 0.4.0.

**Behavior notes**

- Matches on the **resolved** (post-rename) tool name — the same key space as the engine's health recording.
- Appends `"\n\n[verify] passed|failed: <diagnostics>"`; **never sets `is_error`** — a failed verify on a successful write stays a success; the model reads and decides.
- Skipped entirely on tool errors (the tool's own `is_error` preserved).
- Cap interaction: with an outer `OutputLimitMiddleware`, a verify block on output that already fills the cap is truncated away — size the cap with headroom, or observe the verdict from a middleware registered *between* cap and verify.
- Registered outside memoize: cache hits are still verified (the cache never holds a verify block).

Deep dive: [Middleware](/safety/middleware/).
