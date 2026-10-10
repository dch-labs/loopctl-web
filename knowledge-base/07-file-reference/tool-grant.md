# `src/tool/grant.rs` — the grant store [feature: file_grants]

The persisted half of interactive approval: a `Grant` is an approval rule that outlives the run that earned it — "allow `Read` on exactly these arguments" — with a narrowness ladder and a rug-pull defense. Core types compile everywhere; `FileGrantStore` rides the feature (zero dependencies).

**Key items**

- `Grant::new(tool, verdict, scope)` + `with_pinned_descriptor(digest)` / `with_created_at_ms` / `with_note` — the record. Identity is the content-stable 16-hex digest of `{tool, verdict, scope}`: re-granting a rule upserts its own entry.
- `GrantScope` — `ThisTool { tool }` (every call to the tool) or `ThisCall { args }` (exactly the canonically-equal argument sets; key order never decides). `Grant::covers(tool, args)` is the mechanical matcher; deny-over-allow precedence stays consumer policy.
- `GrantVerdict` — allows and denies persist identically.
- `GrantStore` — the sync, object-safe seam: `save` (upsert, returns the grant), `revoke` (removes and returns it — the audit record), `clear`, `load` (a missing ledger is empty).
- `FileGrantStore::new(root, project)` — one project per directory (`<root>/projects/<16-hex project-path digest>/grants.json`, the layout a CLI documents as `~/.local/state/<app>/grants/`).

**Behavior notes**

- Files are created owner-only `0600` and replaced atomically on every write (the staged file's mode is reset on open — a crashed write never leaves a wide file behind).
- Single-writer contract: one process per project; concurrent processes are unsupported (last replace silently wins).
- The rug-pull defense: pair a grant with the tool's `descriptor_digest()` and a later mismatch — the tool's schema changed — is the re-ask signal.

Deep dive: [Approvals](../03-safety/09-approvals.md#the-grant-store--persisted-approvals)
