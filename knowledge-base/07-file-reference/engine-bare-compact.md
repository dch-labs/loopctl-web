# `src/engine/bare/compact.rs` — the driver side of compaction

`run_compaction` and the hook/observer choreography for a `Compact` step.

**Key items**

- `run_compaction(turn, reason) -> CompactStepOutcome { tokens_before, tokens_after, compacted: Option<Vec<Message>> }`:
  1. measure the true size (conversation + overhead — real measurements, never estimates-at-request-time);
  2. no `ContextManager` → unchanged outcome;
  3. pre-compact hook veto → unchanged outcome (hook guidance merged and threaded when not vetoing);
  4. `compact_with_reason(history, turn, reason, instructions, additional_context, reserved)` — `reserved` = overhead + the deferred turn's transients budget;
  5. `Compacted` → fire `on_compaction` + post-compact hooks, return the new messages; `NoAction` → re-measure, return unchanged; `Err(overflow)` → log + `LoopError::ContextExceeded`.

**Behavior notes**

- The handler feeds `compaction_result` (rewritten) vs `compaction_noop` (unchanged) — the machine's no-progress guard applies to both.
- Observers and post-compact hooks fire **only** on real compactions — no-op passes are silent.
- Vetoed passes at over-threshold end the run via the guard — documented, deliberate.

Deep dive: [Compaction](../02-engine/06-compaction.md).
