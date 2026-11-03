---
title: "src/tracing_spans.rs"
---

This file emits the engine's span hierarchy and its signal events: the transparency layer a trace reads. Always compiled, no feature flag, so you always have the tree.

## Key items

The tree is `agent.run`, `agent.turn`, and `agent.tool` DEBUG spans on target `loopctl::engine`. The `fields` module holds the wire names your exporter maps, such as `gen_ai.operation.name`, `gen_ai.conversation.id`, and `gen_ai.usage.*`.

`SIGNAL_EVENT_NAMES` lists the closed signal vocabulary: `loopctl.compaction`, `steering_drain`, `model_switch`, `transport_fallback`, `salvage`, `cancelled`, and `hook_followup`.

`CompactionPassOutcome` and `SalvageKind` are the closed enums the signal fields carry, so a misspelled vocabulary word is a compile error.

## Behavior notes

Spans attach through `tracing::Instrument` only around awaits, never an `EnterGuard` held across an await, so a work-stealing runtime cannot migrate your span between threads.

Tool spans parent to the run scope when the state-machine driver dispatches them, because the turn has closed. The structure is what the handlers dictate, not a lost parent.

The `query` field is the crate's only content-bearing field, at the same DEBUG opt-in. Signal events carry names, counts, figures, and model ids, never message content you did not opt in to.

Figures ride one scale, the engine's provider-token figure. A noop reports `after == before`, and a failed pass that measured reports its measured figures. When you compare token counts across spans, you are always on the same scale.

For the deep dive, see [The span tree](/telemetry/spans/).
