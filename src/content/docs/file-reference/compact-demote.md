---
title: "src/compact/demote.rs"
---

This file decides where compaction's evicted messages go instead of the void. `CompactionOutcome.evicted` is handed to a `DemotionSink` after the history rewrite, so evicted content stays recallable. It is always compiled.

## Key items

`DemotionSink` is your object-safe trait: it receives the evicted messages with their context as a `DemotionContext`.

`MemoryDemotionSink::new(store, max_chars)` is the shipped implementation. It renders each evicted exchange into a `Trajectory`-category memory entry in any `LoopMemory` store you hand it.

`render_evicted(messages, max_chars)` is the renderer behind that: role lines, tool one-liners, and per-part truncation. It is the same transcript renderer the QA summarizer feeds its prompts, and it is public so you can reuse it in your own sink.

`NoopDemotionSink` is your default, where evicted content is dropped.

## Behavior notes

The handoff rides the compaction pass's cancel race, so a cancel during a hanging sink ends your run typed `Cancelled`, never wedged.

Your prune pass, see [context accounting](/engine/context-accounting/), hands its cleared tool outputs to the same sink under `CompactReason::Prune`.

Combine this with `SearchMemoriesTool` and you close the loop: what compaction evicts, your model can recall on demand.

Deep dive: [Compaction demotion](/engine/compaction/#demotion-evicted-is-not-destroyed)
