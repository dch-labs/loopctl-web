# `src/tool/permission.rs` — `PermissionCheck`

The permission decision vocabulary — a small enum, no policy engine.

**Key items**

- `PermissionCheck` — `Allow`, `Deny { reason }`, `Ask { prompt }`, `Modify { modified_input }`.
- Constructors: `allow()`, `deny(...)`, `ask(...)`, `modify(...)`; predicates `is_allow/deny/ask/modify`.

**Behavior notes**

- There is no `PermissionPolicy`/`PermissionSet` type — the *policy* is your function; this enum is the *decision*.
- `Deny.reason` surfaces to the model verbatim (via the middleware's error text) — write concrete reasons.
- `Ask` resolution and `Modify` validation are the caller's responsibilities (the middleware denies unresolved Asks; Modify bypasses schema re-validation).
- `Tool::is_read_only` and `ToolContext::is_non_interactive` are the companion flags policies read.

Deep dive: [Permissions](../03-safety/08-permission.md).
