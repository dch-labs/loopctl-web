---
title: "`src/middleware/permission.rs` — `PermissionMiddleware`"
---


The pipeline's enforcement point for the `PermissionCheck` decision type.

**Key items**

- Constructors: `deny_all()`, `allow_all()`, `from_context()` (honors `ctx.permission`); builders `with_check(fn)`, `with_ask_resolver(async fn)`.
- Types: `PermissionCheckFn`, `AskResolverFn` (args: prompt, tool name; `true` = allow).

**Behavior notes**

- `Deny` short-circuits the whole inner chain: soft error `"Permission <reason> for tool 'x'"`, zero duration — tests pin that nothing inside executes.
- `Ask` without a resolver is **denied** (headless-safe): `"permission required: <prompt>"`.
- `Modify` rewrites `ctx.input` then proceeds — the replacement is not re-validated against the tool's schema.
- Install it outermost (or near) so denial happens before any other layer's work.

Deep dive: [Permissions](/safety/permission/).
