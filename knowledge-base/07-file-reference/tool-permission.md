# `src/tool/permission.rs` — `PermissionCheck` + `GateDecision`

The permission decision vocabulary — a small enum, no policy engine — plus (0.4.0) the decision's serializable audit record.

**Key items**

- `PermissionCheck` — `Allow`, `Deny { reason }`, `Ask { prompt }`, `Modify { modified_input }`.
- Constructors: `allow()`, `deny(...)`, `ask(...)`, `modify(...)`; predicates `is_allow/deny/ask/modify`.
- `GateDecision` (0.4.0) — `{ tool, args_digest, verdict, rule_id, rule_source, matched_pattern, reason, ts }`: one record per gated dispatch, joinable by `call_id`. `GateVerdict` covers all nine paths (Allow/AllowModified/Deny/Ask + AskAllowed/AskDenied/AskUnresolved/AskExpired/Cancelled); `GateRuleSource` carries provenance (middleware / named rule / context / ask resolver / engine).
- `args_digest` — FNV-1a-64 over recursively key-sorted canonical JSON, 16 hex — stable across `serde_json` map backends; of the *original* input for rewritten calls.

**Behavior notes**

- There is no `PermissionPolicy`/`PermissionSet` type — the *policy* is your function; this enum is the *decision*.
- `Deny.reason` surfaces to the model verbatim (via the middleware's error text) — write concrete reasons.
- `Ask` resolution and `Modify` validation are the caller's responsibilities (the middleware denies unresolved Asks; Modify bypasses schema re-validation).
- `Tool::is_read_only` and `ToolContext::is_non_interactive` are the companion flags policies read.

Deep dive: [Permissions](../03-safety/08-permission.md).
