---
title: "src/engine/bare/compact.rs"
---

This file holds `run_compaction` and the hook and observer choreography for a `Compact` step.

## Key items

`run_compaction(turn, reason) -> CompactStepOutcome { tokens_before, tokens_after, compacted: Option<Vec<Message>> }` is the entry point. It reports both token counts and the rewritten messages when there are any.

1. It measures the true size, meaning conversation plus overhead, using real measurements and never estimates-at-request-time.

2. With no `ContextManager` it returns an unchanged outcome.

3. A pre-compact hook veto also returns an unchanged outcome, and hook guidance is merged and threaded when nothing vetoes.

4. It calls `compact_with_reason(history, turn, reason, sizing)`. The `CompactSizing` argument arrived in 0.4.0 and carries your reserve, which is overhead plus the deferred turn's transients.

   That argument also carries any one-pass target override, which is the overflow-salvage target strictly under a refused payload.

5. On `Compacted` it fires `on_compaction` and post-compact hooks and returns your new messages. On `NoAction` it re-measures and returns unchanged, and on `Err(overflow)` it logs and raises `LoopError::ContextExceeded`.

## Behavior notes

Your handler feeds `compaction_result` when the conversation was rewritten and `compaction_noop` when it was not, and the machine's no-progress guard applies to both.

Observers and post-compact hooks fire only on real compactions, so your no-op passes stay silent.

Vetoed passes at over-threshold end the run via the guard, which is documented and deliberate.

## The 0.4.0 additions

Three hooks now bracket your pass. `on_pre_compaction` fires as the pass starts, and a failed pass fires `on_compaction_failed`.

The evicted messages hand off to your configured demotion sink after the history rewrite. This is cancel-raced, so a hanging sink ends the run typed `Cancelled`.

The prune pass in `prune.rs` runs at the pre-request site before the deferral.

For the deep dive, see [Compaction](/engine/compaction/).
