---
title: "`src/engine/bare/compact.rs` — the driver side of compaction"
---


`run_compaction` and the hook/observer choreography for a `Compact` step.

**Key items**

- `run_compaction(turn, reason) -> CompactStepOutcome { tokens_before, tokens_after, compacted: Option<Vec<Message>> }`:
  1. measure the true size (conversation + overhead — real measurements, never estimates-at-request-time);
  2. no `ContextManager` → unchanged outcome;
  3. pre-compact hook veto → unchanged outcome (hook guidance merged and threaded when not vetoing);
  4. `compact_with_reason(history, turn, reason, sizing)` — the `CompactSizing` argument (0.4.0) carries the reserve (overhead + the deferred turn's transients) and any one-pass target override (the overflow-salvage target strictly under a refused payload);
  5. `Compacted` → fire `on_compaction` + post-compact hooks, return the new messages; `NoAction` → re-measure, return unchanged; `Err(overflow)` → log + `LoopError::ContextExceeded`.

**Behavior notes**

- The handler feeds `compaction_result` (rewritten) vs `compaction_noop` (unchanged) — the machine's no-progress guard applies to both.
- Observers and post-compact hooks fire **only** on real compactions — no-op passes are silent.
- Vetoed passes at over-threshold end the run via the guard — documented, deliberate.

Deep dive: [Compaction](/engine/compaction/).

- 0.4.0 additions bracketing the pass: `on_pre_compaction` fires as the pass starts; a failed pass fires `on_compaction_failed`; the evicted messages hand off to the configured demotion sink after the history rewrite (cancel-raced — a hanging sink ends the run typed `Cancelled`); the prune pass (`prune.rs`) runs at the pre-request site before the deferral.
