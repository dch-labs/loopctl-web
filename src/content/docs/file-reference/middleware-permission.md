---
title: "src/middleware/permission.rs"
---

This file gives you `PermissionMiddleware`, your pipeline's enforcement point for the `PermissionCheck` decision type. Place it where you want denial to happen before work.

## Key items

Constructors: `deny_all()`, `allow_all()`, and `from_context()`, which honors `ctx.permission`. Your builders are `with_check(fn)`, `with_named_check(rule_id, fn)` from 0.4.0, where the rule id rides the gate record, and `with_ask_resolver(async fn)`.

`evaluate(tool_name, input)`, new in 0.4.0, resolves a synthetic dispatch through the real rule stack without executing.

That is your dry-run/`plan` API.

An `Ask` evaluates to `Ask` with the prompt in `reason`, and never consults the resolver during a dry run.

Every decision mints a `GateDecision` record riding the dispatch result, see [tool/permission](/file-reference/tool-permission/).

Your types are `PermissionCheckFn` and `AskResolverFn`, the latter taking a prompt and tool name and returning `true` for allow.

## Behavior notes

`Deny` short-circuits the whole inner chain with the soft error `"Permission <reason> for tool 'x'"` and zero duration, and tests pin that nothing inside executes.

`Ask` without a resolver is denied, which keeps headless runs safe: `"permission required: <prompt>"`.

A user refusal logs the same `warn` as every other denial since 0.3.2, and a cancel while the answer is pending aborts the wait with `cancelled while awaiting approval`.

A cancelled run never executes your tool, whatever the resolver returns late.

`Modify` rewrites `ctx.input` then proceeds, and the replacement is not re-validated against the tool's schema.

Install this outermost, or near it, so denial happens before any other layer's work.

Deep dive: [Permissions](/safety/permission/).
