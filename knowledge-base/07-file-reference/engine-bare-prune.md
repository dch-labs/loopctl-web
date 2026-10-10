# `src/engine/bare/prune.rs` — the no-LLM reclamation pass

The opt-in prune: old tool results beyond a protected tail are cleared to `[cleared: prior tool output]` markers without any summarizer call — freeing context cheaply, at the pre-request site before the compaction deferral.

**Key items**

- `PruneConfig` — the protected tail token budget (default 2,000) and the minimum-free gate (a fraction of the window, default 10%, evaluated in the counter's raw units so a settled calibration ratio cannot distort the verdict).
- `BareLoop::set_prune(config)` — opt-in (default absent = off); the prune line must sit strictly below the compaction threshold — validated with `InvalidInput`, never clamped.

**Behavior notes**

- Clearing order: untagged results first; `Requery` only when the untagged pool can't satisfy the minimum-free gate; `Durable` never. Identity survives the marker (call id, tool name, error flag, retention class), oldest first, deterministic.
- The originals hand off to the demotion sink under `CompactReason::Prune` — pruned is not destroyed.
- A prune that frees enough can avert the compaction it would otherwise defer to; the machine adopts the rewritten conversation through `LoopMachine::adopt_pruned` (history/pending split preserved, no state transition).

Deep dive: [Context accounting — prune](../02-engine/09-context-accounting.md#prune--reclamation-without-a-summarizer)
