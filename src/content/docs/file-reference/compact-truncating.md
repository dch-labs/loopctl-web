---
title: "`src/compact/truncating.rs` — `TruncatingCompactor` and `TokenSplitter`"
---


The default shrink strategy (dependency-free, no LLM calls) and the exported splitter for custom compactors.

**Key items**

- `TruncatingCompactor { preserve_recent: 4, min_messages: 6 }` + builders (clamped to minimums 1 / 2).
- `TokenSplitter` — same knobs; `split(&messages) -> SplitResult { to_compact, preserved, token counts, split_index }`.
- Tool-pair machinery (private): `PartMate`/`ToolPairing` — per-occurrence call↔result pairing, orphan-safe split adjustment, first-message result reattachment.

**Behavior notes**

- Rules: conversations under `min_messages` pass through; the first message is always kept; tool call/result pairs are never orphaned (the split point moves, a fixpoint loop rechecking newly admitted messages); never returns an empty list.
- The target token budget is a hint here — the truncator sheds by message count; the manager's fit check decides adequacy.
- `TokenSplitter` splits only at assistant→user turn boundaries that are pair-safe; no safe boundary → everything is preserved (`split_index: 0`) — the safe direction.
- Even "no change" paths filter orphaned lone results and report the savings honestly.

Deep dive: [Compaction](/engine/compaction/).
