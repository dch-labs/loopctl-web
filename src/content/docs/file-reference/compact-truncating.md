---
title: "src/compact/truncating.rs"
---

This file holds your default shrink strategy, which is dependency-free and makes no LLM calls. It also holds the exported splitter you use in custom compactors.

## Key items

`TruncatingCompactor { preserve_recent: 4, min_messages: 6 }` comes with builders clamped to minimums 1 and 2.

`TokenSplitter` takes the same knobs. Rules for the split come from the same pair. Your `split(&messages) -> SplitResult { to_compact, preserved, token counts, split_index }` call returns what to compact and what to keep.

Tool-pair machinery stays private: `PartMate` and `ToolPairing` give you per-occurrence call and result pairing, orphan-safe split adjustment, and first-message result reattachment.

## Behavior notes

Conversations under `min_messages` pass through untouched, and the first message is always kept for you.

Tool call and result pairs are never orphaned, because the split point moves and a fixpoint loop rechecks newly admitted messages. Your compactor never returns an empty list.

The target token budget is a hint here, since the truncator sheds by message count and your manager's fit check decides adequacy.

`TokenSplitter` splits only at assistant-to-user turn boundaries that are pair-safe. If there is no safe boundary, everything is preserved with `split_index: 0`, which is the safe direction.

Even your no-change paths filter orphaned lone results and report the savings honestly.

For the deep dive, see [Compaction](/engine/compaction/).
