---
title: "`src/engine/core/machine.rs` — the `LoopMachine`"
---


The brain: pure, serializable state; decides every step; never does IO. (~1,600 lines with docs/tests.)

**Key items**

- Fields: `state`, `history`, `pending`, `pending_tools`, `turns_taken`, `context_tokens`, `cancelled`, `last_compaction_tokens`, `deferred_compaction` (0.4.0 — the latch for a threshold pass that declined while the payload fit).
- Steps & feeds: `next_step(policy)`; `model_response` (classifies tool calls against `available_tools`, pre-answering unknown ones), `tool_results` (the only `pending_tools` consumer), `compaction_result` (wholesale replace + pending clear), `compaction_noop` (buffers untouched), `adopt_pruned` (0.4.0 — adopts a pruned conversation, splitting at the old history length, no state transition), `set_context_tokens`, `inject`, `cancel`, `fail`, `accept_input`.
- Maintenance: `commit_pending`, **`salvage_pending`** (0.4.0 — the longest coherent prefix commits, the unanswered tail drops), `discard_pending`.
- Reads: `history`, `full_history`, `state`, `turns_taken`, **`context_tokens`** (0.4.0 read accessor), `is_terminal`, `is_cancelled`.
- `MachinePolicy { max_turns, context_window, compact_threshold, auto_compact }` — passed fresh each step, never stored.
- `Serialize + Deserialize` — checkpoint/resume round-trips pinned by tests (identical decisions after restore).

**Behavior notes**

- Decision order per step: terminal → cancelled → (model-side) turn limit → emergency ≥95% → threshold >N% → CallLLM.
- `next_step` is pure and repeatable; terminal is forever; `fail()` guarantees an errored machine carries its failure into serialization.
- The no-progress guard (`tokens_after >= tokens_before` → `Failed(CompactionStalled)`, typed since 0.4.0) runs in both compaction feeds, before any buffer mutation — with the carve-out that a threshold-triggered stall whose payload still fits the window defers (`deferred_compaction`) and serves instead; the emergency line ignores the latch.
- Checkpoint/resume is pinned at the run boundary — resuming a machine serialized mid-phase is documented as unsupported, not "close enough".

Deep dive: [The state machine](/engine/state-machine/).
