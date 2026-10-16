---
title: "src/middleware/verify.rs"
---

This file and `verify/builtin.rs` hold `VerifyMiddleware`, which runs your verifier after write-class tools succeed and appends the verdict. That is verify-on-write made automatic.

Since 0.4.0 the module ships a real builtin called `CommandVerifier`. It judges write-class calls statically with a deny-glob check on shell commands and a target-path check on write inputs, and it writes one-line diagnostics for a small-model reader.

The deny-glob check catches `rm -rf /` in any spacing at token boundaries.

A wrapped `sh -c "…"` must name an allowed shell, after which the inner command is checked too. The path check asks that the parent exists and is writable.

## Key items

`Verifier::verify(ctx, tool_name) -> VerifyResult { passed, diagnostics }` is async and boxed like `Tool::call`, and `NoopVerifier` is your explicit opt-out.

`VerifyMiddleware::new(verifier, write_tools)` takes exact-match names.

The default pipeline since 0.4.0 wires two builtins for you. Those are `CommandVerifier::new()`, which takes `with_deny_globs` and `with_allowed_shells`, and `WritePathExtractor`.

## Behavior notes

Matching happens on the resolved, post-rename tool name, which is the same key space the engine's health recording uses.

The middleware appends `"\n\n[verify] passed|failed: <diagnostics>"` and never sets `is_error`, so a failed verify on a successful write stays a success and your model reads it and decides.

It is skipped entirely on tool errors, where the tool's own `is_error` is preserved.

Watch the cap interaction. With an outer `OutputLimitMiddleware`, a verify block on output that already fills the cap is truncated away.

So size your cap with headroom, or observe the verdict from a middleware you register between cap and verify.

It is registered outside memoize, so your cache hits are still verified and the cache never holds a verify block.

For the deep dive, see [Middleware](/safety/middleware/).
