# `src/compact/truncating.rs` — `TruncatingCompactor` and `TokenSplitter`

The default shrink strategy (dependency-free, no LLM calls) and the exported splitter for custom compactors.

**Key items**

- `TruncatingCompactor { preserve_recent: 4, min_messages: 6 }` + builders (clamped to minimums 1 / 2).
- `TokenSplitter` — same knobs; `split(&messages) -> SplitResult { to_compact, preserved, token counts, split_index }` and `split_within_budget` (the budgeted variant both LLM summarizers use).
- Tool-pair machinery (private): `PartMate`/`ToolPairing` — per-occurrence call↔result pairing, orphan-safe split adjustment, first-message result reattachment.

**Behavior notes**

- Rules: conversations under `min_messages` pass through; the first message is always kept; tool call/result pairs are never orphaned (the split point moves, a fixpoint loop rechecking newly admitted messages); never returns an empty list.
- The target token budget is a hint here — the truncator sheds by message count; the manager's fit check decides adequacy.
- `TokenSplitter` splits only at assistant→user turn boundaries that are pair-safe; no safe boundary → everything is preserved (`split_index: 0`) — the safe direction.
- The budgeted variant falls back to the **deepest pair-safe cut** when no tail fits (0.4.1), never the plain preserve-almost-everything shape — a history with sparse boundaries used to compact to a no-op every pass and drift into the emergency stall. Only a history with no pair-safe cut at all keeps the count-based default. It also pulls `Durable` receipts within the landing's budget (`durable_pull_indices_within_budget`, 0.4.1): newest pairs first, a pair too costly to fit is skipped — the same budgeted walk the truncating terminal and both summarizers share, occurrence-aware so a reused call id pairs with its own exchange.
- Even "no change" paths filter orphaned lone results and report the savings honestly.

Deep dive: [Compaction](../02-engine/06-compaction.md).
