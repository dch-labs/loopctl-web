---
title: "`src/hooks.rs` — the `Hook` trait [feature: hooks]"
---


The controlling counterpart to observers: pre-hooks can block tool calls and compaction.

**Key items**

- `Hook` — `name` (required), `on_pre_tool_use -> Option<HookAction>`, `on_pre_compact -> Option<CompactResult>`, `on_post_tool_use`, `on_post_compact`, `on_run_start`, `on_run_end`.
- `HookAction` — `Allow`, `Block { reason }`, `Ask { message }`; helpers `block`, `ask`, `is_*`, `block_reason`.
- `Interactivity` — `Headless` (default: Ask → Block, message preserved) vs `Interactive`.
- `CompactResult { abort, abort_reason, new_instructions, additional_context }` — constructors `allow`, `abort`, `with_context` (additive, preferred), `with_instructions` (replaces; use sparingly).
- Module re-exports the executor, contexts, and built-ins.

**Behavior notes**

- First non-Allow pre-tool result wins; explicit `Allow` never short-circuits; register safety-critical hooks first.
- Hooks are synchronous by contract — no IO; do async work at registration or through caches.
- There is no `HookError` type — failures surface through domain results.

Deep dive: [Hooks](/extensions/hooks/).
