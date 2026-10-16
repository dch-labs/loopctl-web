---
title: "src/tool/permission.rs"
---

This file holds your permission decision vocabulary: a small enum with no policy engine, plus (0.4.0) the decision's serializable audit record.

## Key items

`PermissionCheck` offers `Allow`, `Deny { reason }`, `Ask { prompt }`, and `Modify { modified_input }`.

Constructors: `allow()`, `deny(...)`, `ask(...)`, and `modify(...)`. Test the result with the predicates `is_allow`, `is_deny`, `is_ask`, and `is_modify`.

`GateDecision` (0.4.0) carries `{ tool, args_digest, verdict, rule_id, rule_source, matched_pattern, reason, ts }`: one record per gated dispatch, joinable by `call_id`.

`GateVerdict` covers all nine paths: Allow, AllowModified, Deny, Ask, plus AskAllowed, AskDenied, AskUnresolved, AskExpired, and Cancelled.

`GateRuleSource` carries provenance, whether middleware, named rule, context, ask resolver, or engine.

`args_digest` is FNV-1a-64 over recursively key-sorted canonical JSON, rendered as 16 hex. It stays stable across `serde_json` map backends, and for rewritten calls it digests the original input.

## Behavior notes

There is no `PermissionPolicy` or `PermissionSet` type here. Your policy is your function, and this enum is the decision.

`Deny.reason` surfaces to your model verbatim through the middleware's error text, so write concrete reasons.

`Ask` resolution and `Modify` validation are your responsibilities as the caller: the middleware denies unresolved Asks, and Modify bypasses schema re-validation.

`Tool::is_read_only` and `ToolContext::is_non_interactive` are the companion flags your policies read.

Deep dive: [Permissions](/safety/permission/).
