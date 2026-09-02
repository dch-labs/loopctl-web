# `src/tool/shield.rs` — the safety shield [feature: tool_shield]

Risk scoring for dangerous tool input: the trait, the decision types, and `UnixShield` with its pattern table.

**Key items**

- `ToolSafetyShield` — `evaluate(&ShieldContext) -> SafetyDecision` (must be deterministic), `record_invocation`, `watched_tools`.
- `SafetyDecision { action: Allow|Warn|Block, reason, category }`; `RiskLevel` — Safe <0.2, Low, Medium, High, Critical ≥0.9.
- `ShieldContext { tool_name, input, turn, recent_calls (last 20) }`.
- `RiskPattern { name, score, pattern }` (substring, max wins) and `CombinationRule { description, score, triggers }` (all triggers in order, max wins).
- `UnixShield::builder()` — thresholds warn 0.4 / block 0.7; `.blank()` for non-Unix tables; `with_pattern` **appends**; `NullShield` — the feature-off no-op.

**Behavior notes**

- Aggregate: `(single + 0.5×repetition + 0.3×combination).min(1.0)`; repetition alone caps at 0.3 — repeated benign calls never block.
- Matching runs on normalized input (lowercased, whitespace collapsed) with token-boundary discipline: word-character edges constrained (`curl` ≠ `mycurlcmd`), symbol edges free (`/etc/` matches `/etc/passwd`); flag-spelling variants are separate patterns; empty patterns match nothing.
- Default table keys on exact tool names `"Bash"`/`"Write"`/`"Edit"`; combination triggers are unioned into the watched set.
- `with_thresholds` rejects non-finite values and swaps an inverted pair (the *builder* setters don't — prefer `with_thresholds`).

Deep dive: [The shield](../03-safety/07-tool-shield.md).
