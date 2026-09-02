---
title: "`src/hooks/builtin/` — the shipped hooks [feature: hooks]"
---


Four ready-made hooks: auto-commit, blocklist, confirmation, logging. Re-exported from `hooks::builtin`.

**Key items — `auto_commit.rs`**

- `AutoCommitHook` + `AutoCommitConfig { enabled, message_template ("chore(agent): auto-commit" with `{{tool}}`/`{{session}}`), auto_push, push_branch, skip_if_clean, commit_mode (Create/Amend), commit_on_tools (["Write","Edit"]), files }` (+ builder).
- `GitExecutor` — the subprocess wrapper: 30s timeout per call (kill -9 on expiry), `has_changes`, `stage_files` (per-file `git add`; **empty list is a hard error — never `git add -A`**), `commit`, `push`, `get_head_sha`; `GitExecutorError` (incl. `NoChanges`, `Timeout`).
- `AutoCommitResult` — `Committed { sha }`, `NoChanges`, `Skipped { reason }`, `Failed { error }`.

**Key items — the small ones**

- `BlocklistHook::deny(names)` / `allow_only(names)` — exact names; deny wins; empty allowlist allows everything.
- `ConfirmationHook::new(tools, handler)` — `ConfirmationHandler::confirm(message) -> bool`; denial → `Block("User denied permission")`; framework provides no stdin reader or timeout.
- `LoggingHook` — debug-level tracing for tool/compact events; no run-boundary logging; no side effects.

**Behavior notes**

- AutoCommit tracks `file_path`s from listed tools and commits at run end; with several tracked tools `{{tool}}` names the most recent; unknown placeholders pass through verbatim.
- Default config + dirty tree + no tracked tool call = `Failed` (refuses to stage) — deliberate loud failure.
- Git runs in the process CWD, synchronously inside `on_run_end` — a hung git delays run completion (bounded to 30s per call).

Deep dive: [Hooks](/extensions/hooks/).
