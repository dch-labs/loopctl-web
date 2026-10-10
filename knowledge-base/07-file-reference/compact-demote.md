# `src/compact/demote.rs` — the demotion sink

Where compaction's evicted messages go instead of the void: `CompactionOutcome.evicted` is handed to a `DemotionSink` after the history rewrite, so evicted content stays recallable. Always compiled.

**Key items**

- `DemotionSink` — the object-safe trait: receive the evicted messages with their context (`DemotionContext`).
- `MemoryDemotionSink::new(store, max_chars)` — the shipped implementation: renders each evicted exchange into a `Trajectory`-category memory entry in any `LoopMemory` store.
- `render_evicted(messages, max_chars)` — the renderer (role lines, tool one-liners, per-part truncation) — the same transcript renderer the QA summarizer feeds its prompts. Public: reuse it for your own sink.
- `NoopDemotionSink` — the default (evicted content is dropped).

**Behavior notes**

- The handoff rides the compaction pass's cancel race — a cancel during a hanging sink ends the run typed `Cancelled`, never wedged.
- The prune pass (see [context accounting](../02-engine/09-context-accounting.md)) hands its cleared tool outputs to the same sink under `CompactReason::Prune`.
- Combined with `SearchMemoriesTool`, this closes the loop: what compaction evicts, the model can recall on demand.

Deep dive: [Compaction — demotion](../02-engine/06-compaction.md#demotion--evicted-is-not-destroyed)
