---
title: "src/hooks/executor.rs"
---

This file runs your hooks: pre-checks with short-circuit semantics, notifications with none. It is where you learn which hook gets to say no.

## Key items

You create a `HookExecutor` with `HookExecutor::new()`, which starts Headless, then add hooks through `with_interactivity(...)`, `with_hook(...)`, or `register(...)`. Your `hook_count()` reports how many you installed.

`check_pre_tool_use(ctx) -> HookAction` lets the first non-Allow win. Under `apply_interactivity`, Ask downgrades to block in Headless with the message preserved in the reason.

`check_pre_compact(ctx) -> CompactResult` is abort-first. Instructions accumulate into the context as your hooks run, the last `new_instructions` wins, and `additional_context` extends.

Your notify methods run every hook: `notify_post_tool_use`, `notify_post_compact`, and `notify_run_start` plus `notify_run_end`, each with `*_async` ready-future wrappers that do no task spawning.

## Behavior notes

Your hooks are stored in registration order, append-only, never reordered. Register the same instance twice and it runs twice.

An empty executor returns `Allow` and a default `CompactResult` in both interactivity modes.

Your engine consults this file at the exact boundaries: pre-tool before dispatch, where a block becomes a soft error result, and pre-compact before a pass.

Deep dive: [Hooks](/extensions/hooks/).
