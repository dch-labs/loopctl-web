---
title: "src/tool/grant.rs"
---

This file is your persisted half of interactive approval, under the `file_grants` feature. A `Grant` is an approval rule that outlives the run where you earned it, such as allowing `Read` on exactly these arguments.

It comes with a narrowness ladder and a rug-pull defense. Your core types compile everywhere, and `FileGrantStore` rides the feature with zero dependencies.

## Key items

`Grant::new(tool, verdict, scope)` builds your record. You refine it with `with_pinned_descriptor(digest)`, `with_created_at_ms`, and `with_note`.

Your grant's identity is the content-stable 16-hex digest of `{tool, verdict, scope}`, so re-granting a rule upserts its own entry.

`GrantScope` is either `ThisTool { tool }`, covering every call you make to the tool, or `ThisCall { args }`, covering exactly the canonically-equal argument sets.

Key order never decides which set matches yours.

`Grant::covers(tool, args)` is the mechanical matcher for you, and deny-over-allow precedence stays your consumer policy.

`GrantVerdict` lets allows and denies persist identically.

`GrantStore` is your sync, object-safe seam. It gives you `save`, which upserts and returns the grant, and `revoke`, which removes and returns it as your audit record.

You also get `clear` and `load`, where a missing ledger reads as empty.

`FileGrantStore::new(root, project)` gives one project per directory at `<root>/projects/<16-hex project-path digest>/grants.json`. That is the layout a CLI documents as `~/.local/state/<app>/grants/`.

## Behavior notes

Your files are created owner-only `0600` and replaced atomically on every write. The staged file's mode is reset on open, so a crashed write never leaves a wide file behind.

The store has a single-writer contract: one process per project. If you run concurrent processes, that is unsupported, and the last replace silently wins.

For the rug-pull defense, pair a grant with the tool's `descriptor_digest()`. A later mismatch means the tool's schema changed, which is your re-ask signal.

For the deep dive, see [the grant store](/safety/approvals/#the-grant-store).
