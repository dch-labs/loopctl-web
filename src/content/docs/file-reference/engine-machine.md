---
title: "`src/engine/core/machine.rs` — the `LoopMachine`"
---


The brain: pure, serializable state; decides every step; never does IO. (~1,600 lines with docs/tests.)

**Key items**

- Fields: `state`, `history`, `pending`, `pending_tools`, `turns_taken`, `context_tokens`, `cancelled`, `last_compaction_tokens`.
- Steps & feeds: `next_step(policy)`; `model_response` (classifies tool calls against `available_tools`, pre-answering unknown ones), `tool_results` (the only `pending_tools` consumer), `compaction_result` (wholesale replace + pending clear), `compaction_noop` (buffers untouched), `set_context_tokens`, `inject`, `cancel`, `fail`, `accept_input`.
- Maintenance: `commit_pending`, `discard_pending`.
- Reads: `history`, `full_history`, `state`, `turns_taken`, `is_terminal`, `is_cancelled`.
- `MachinePolicy { max_turns, context_window, compact_threshold, auto_compact }` — passed fresh each step, never stored.
- `Serialize + Deserialize` — checkpoint/resume round-trips pinned by tests (identical decisions after restore).

**Behavior notes**

- Decision order per step: terminal → cancelled → (model-side) turn limit → emergency ≥95% → threshold >N% → CallLLM.
- `next_step` is pure and repeatable; terminal is forever; `fail()` guarantees an errored machine carries its failure into serialization.
- The no-progress guard (`tokens_after >= tokens_before` → `Failed(ContextExceeded)`) runs in both compaction feeds, before any buffer mutation.

Deep dive: [The state machine](/engine/state-machine/).
