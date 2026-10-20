---
title: "src/engine/core/machine.rs"
---

This file holds `LoopMachine`, the brain: pure, serializable state that decides every step and never does IO. It runs about 1,600 lines with docs and tests.

## Key items

The fields are `state`, `history`, `pending`, `pending_tools`, `turns_taken`, `context_tokens`, `cancelled`, and `last_compaction_tokens`.

There is also `deferred_compaction`, new in 0.4.0. You use it as the latch for a threshold pass that declined while your payload fit.

Steps and feeds are where you drive the machine. You get `next_step(policy)`, `inject`, `cancel`, `accept_input`, and `fail`.

`model_response` classifies tool calls against `available_tools`, pre-answering unknown ones. `tool_results` is the only `pending_tools` consumer.

`compaction_result` does a wholesale replace plus a pending clear for you, and `compaction_noop` leaves your buffers untouched. Since 0.4.1 the adopted history runs through the adjacent-assistant coalescer: your summary and a tail opening with an assistant turn fold into one message, the shape a transcript rebuild produces.

`adopt_pruned` arrived in 0.4.0 and adopts a pruned conversation for you. It splits at the old history length and performs no state transition.

Maintenance gives you `commit_pending`, `salvage_pending`, and `discard_pending`. `salvage_pending` came in 0.4.0, where the longest coherent prefix commits and the unanswered tail drops.

`rewind_to(len)` arrived in 0.4.1 and drops committed history past `len`, snapping the cut to a turn boundary. It refuses while a turn is in flight, and a `len` at or beyond the current length is `Ok(0)`.

It clears the deferred-compaction latch and invalidates your usage anchor and any prepared turn. `last_coherent_len` is the unbounded face of the shared `coherent_cut(messages, limit)`.

Reads give you `history`, `full_history`, `state`, and `turns_taken`. You also get `is_terminal`, `is_cancelled`, and `context_tokens`, a new read accessor in 0.4.0.

`MachinePolicy { max_turns, context_window, compact_threshold, auto_compact }` is passed to your machine fresh each step and never stored.

The machine is `Serialize + Deserialize`, and checkpoint and resume round-trips are pinned by tests, so you get identical decisions after restore.

## Behavior notes

Decision order per step runs terminal, then cancelled, then the model-side turn limit, then emergency at 95% or more, then threshold above N%, then CallLLM.

`next_step` is pure and repeatable, and terminal is forever. `fail()` guarantees an errored machine carries its failure into serialization.

The no-progress guard runs in both your compaction feeds, before any buffer mutation, and it is typed as `Failed(CompactionStalled)` since 0.4.0.

There is one carve-out: a threshold-triggered stall whose payload still fits the window defers through `deferred_compaction` and serves instead, while the emergency line ignores the latch.

Checkpoint and resume are pinned at your run boundary. If you resume a machine serialized mid-phase, that is documented as unsupported, not as close enough.

For the deep dive, see [The state machine](/engine/state-machine/).
