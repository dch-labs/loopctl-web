---
title: "`src/hooks/executor.rs` — `HookExecutor`"
---


Runs the hooks: pre-checks with short-circuit semantics, notifications with none.

**Key items**

- `HookExecutor::new()` (Headless) / `with_interactivity(...)` / `with_hook(...)` / `register(...)`; `hook_count()`.
- `check_pre_tool_use(ctx) -> HookAction` — first non-Allow wins; `apply_interactivity` downgrades Ask in Headless with the message preserved in the reason.
- `check_pre_compact(ctx) -> CompactResult` — abort-first; instructions accumulate into the context as hooks run; last `new_instructions` wins; `additional_context` extends.
- Notify methods (all hooks run): `notify_post_tool_use`, `notify_post_compact`, `notify_run_start/end` (+ `*_async` ready-future wrappers — no task spawning).

**Behavior notes**

- Hooks are stored in registration order, append-only, never reordered; the same instance registered twice runs twice.
- Empty executor → `Allow` / default `CompactResult` in both interactivity modes.
- The engine consults this at the exact boundaries: pre-tool before dispatch (block → soft error result), pre-compact before a pass.

Deep dive: [Hooks](/extensions/hooks/).
