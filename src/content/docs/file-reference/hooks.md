---
title: "src/hooks.rs"
---

This file defines the controlling counterpart to your observers: under the `hooks` feature, pre-hooks can block tool calls and compaction.

## Key items

Your `Hook` trait requires `name` and offers `on_pre_tool_use -> Option<HookAction>`, `on_pre_compact -> Option<CompactResult>`, `on_post_tool_use`, `on_post_compact`, `on_run_start`, and `on_run_end`.

`HookAction` gives you `Allow`, `Block { reason }`, and `Ask { message }`, with the helpers `block`, `ask`, `is_*`, and `block_reason`.

`Interactivity` is either `Headless`, the default where Ask becomes Block with the message preserved, or `Interactive`.

`CompactResult { abort, abort_reason, new_instructions, additional_context }` comes with constructors `allow`, `abort`, `with_context` which is additive and preferred, and `with_instructions` which replaces and deserves restraint.

The module re-exports your executor, contexts, and built-ins.

## Behavior notes

Your first non-Allow pre-tool result wins, and an explicit `Allow` never short-circuits, so register safety-critical hooks first.

Hooks are synchronous by contract and do no IO. Move async work to registration or route it through caches.

There is no `HookError` type here. Your failures surface through domain results instead.

Deep dive: [Hooks](/extensions/hooks/).
