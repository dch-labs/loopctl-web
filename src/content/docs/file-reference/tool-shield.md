---
title: "src/tool/shield.rs"
---

This file scores the risk of dangerous tool input under the `tool_shield` feature: the trait, the decision types, and `UnixShield` with its pattern table.

## Key items

Your `ToolSafetyShield` needs `evaluate(&ShieldContext) -> SafetyDecision`, which must be deterministic, plus `record_invocation` and `watched_tools`.

`SafetyDecision { action: Allow|Warn|Block, reason, category }` is what you return. `RiskLevel` runs Safe below 0.2, then Low, Medium, High, and Critical at 0.9 and above.

`ShieldContext { tool_name, input, turn, recent_calls }` hands you the last 20 watched calls.

`RiskPattern { name, score, pattern }` matches substrings and the maximum wins. `CombinationRule { description, score, triggers }` requires all triggers in order, again with the maximum winning.

`UnixShield::builder()` ships thresholds warn 0.4 and block 0.7. Use `.blank()` for non-Unix tables, remember that `with_pattern` appends, and know that `NullShield` is the feature-off no-op.

## Behavior notes

Your aggregate is `(single + 0.5×repetition + 0.3×combination).min(1.0)`, and repetition alone caps at 0.3, so repeated benign calls never block you.

Matching runs on normalized input, lowercased with whitespace collapsed, with token-boundary discipline. Word-character edges are constrained, so `curl` does not match inside `mycurlcmd`, while symbol edges stay free, so `/etc/` matches `/etc/passwd`.

Flag-spelling variants are separate patterns, and empty patterns match nothing.

Your default table keys on exact tool names `"Bash"`, `"Write"`, and `"Edit"`, and combination triggers are unioned into the watched set.

`with_thresholds` rejects non-finite values and swaps an inverted pair, while the builder setters do not, so prefer `with_thresholds`.

Deep dive: [The shield](/safety/tool-shield/).
