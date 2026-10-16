---
title: "src/hooks/builtin/"
---

This folder ships four ready-made hooks under the `hooks` feature: auto-commit, blocklist, confirmation, and logging. They are re-exported from `hooks::builtin`.

## Key items, auto_commit.rs

`AutoCommitHook` reads `AutoCommitConfig { enabled, message_template, auto_push, push_branch, skip_if_clean, commit_mode, commit_on_tools, files }` plus a builder.

The default `message_template` is `"chore(agent): auto-commit"` and expands `{{tool}}` and `{{session}}`, while `commit_mode` is Create or Amend and `commit_on_tools` defaults to `["Write","Edit"]`.

`GitExecutor` is your subprocess wrapper with a 30s timeout per call and a kill -9 on expiry. It gives you `has_changes`, `stage_files`, `commit`, `push`, and `get_head_sha`.

`stage_files` runs a per-file `git add`, and an empty list is a hard error, never `git add -A`. `GitExecutorError` includes `NoChanges` and `Timeout`.

`AutoCommitResult` is `Committed { sha }`, `NoChanges`, `Skipped { reason }`, or `Failed { error }`.

## Key items, the small ones

`BlocklistHook::deny(names)` and `allow_only(names)` compare exact names, deny wins, and an empty allowlist allows everything.

`ConfirmationHook::new(tools, handler)` calls your `ConfirmationHandler::confirm(message) -> bool`, and a denial becomes `Block("User denied permission")`. The framework gives you no stdin reader and no timeout.

`LoggingHook` traces tool and compact events at debug level, with no run-boundary logging and no side effects.

## Behavior notes

AutoCommit tracks `file_path` values from your listed tools and commits at run end. With several tracked tools, `{{tool}}` names the most recent, and unknown placeholders pass through verbatim.

Default config plus a dirty tree plus no tracked tool call yields `Failed`, because it refuses to stage. That loud failure is deliberate.

Git runs in your process CWD, synchronously inside `on_run_end`, so a hung git delays run completion, bounded to 30s per call.

Deep dive: [Hooks](/extensions/hooks/).
