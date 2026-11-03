---
title: "The span tree"
sidebar:
  order: 2
---

A run renders as a trace: three nested DEBUG spans on target `loopctl::engine`, plus named signal events that narrate each decision. Any `tracing-subscriber` collector you run can read them, and an OTLP exporter turns them into a Jaeger or Tempo trace. Source: `src/tracing_spans.rs`.

The module is always compiled, with no feature flag. Added in 0.5.0.

## The tree

```text
agent.run            gen_ai.operation.name=invoke_agent  gen_ai.conversation.id=…  gen_ai.request.model=…
├─ agent.turn        turn=0  query="…"  → records outcome, duration_ms, usage on close
├─ agent.tool        gen_ai.tool.name=…  gen_ai.tool.call.id=…  → records outcome, duration_ms, error.type
└─ …
```

One `agent.run` per run, one `agent.turn` per settled turn, one `agent.tool` per dispatch. Wire-facing fields carry their final OTel GenAI names from emission, so an exporter you point at them maps the fields one-to-one and renames nothing.

Two nesting details save you a double take. Tool spans parent to the run scope when the engine dispatches them from its state-machine driver, because the turn has already closed.

The turn span also records `gen_ai.request.model` once the request is assembled. A fallback-served turn you inspect is attributed to the model that served it, not the run's starting model.

Usage fields on the turn span record by presence, not zero. A provider that said nothing about caching leaves the field absent, so you cannot read "nothing was cached" off a silent report.

The `query` field is the crate's only content-bearing field. It rides the turn span at DEBUG, so a host you filter below DEBUG opts out of content capture by construction.

## The RUST_LOG contract

| Target | Emissions | Levels |
|---|---|---|
| `loopctl::engine` | The span tree plus signal events | spans and events DEBUG; lifecycle progression INFO; problems WARN, bounded to once per condition |
| `loopctl::metrics` | Metric events | DEBUG only, never spans. The `MetricsLayer` filter needs `loopctl::metrics=debug` |
| `loopctl::compact`, `::structured`, `::trajectory`, `::memory`, `::pricing`, `::provider::forensics` | Existing events plus the `structured.extract` and `trajectory.run` spans | DEBUG; forensics WARN bounded |

Three presets cover the common hosts:

| Preset | What you see |
|---|---|
| `loopctl=warn` | Production: problems only, bounded |
| `loopctl=info` | Lifecycle events without the trace |
| `loopctl=debug` | Full trace trees, signal events, and metric events |

## Signal events

Beyond the tree, the engine narrates its decisions as named DEBUG events on `loopctl::engine`. One decision point per name, one fixed field set per name. Under an OTLP exporter each attaches to the span in whose scope it fired, so one trace reads as the whole story.

| Event | Fires at | Fields |
|---|---|---|
| `loopctl.compaction` | A compaction pass settles | `reason` (`prune`, `threshold`, `emergency`, `manual`), `tokens_before`, `tokens_after`, `outcome` (`applied`, `noop`, `deferred`, `failed`) |
| `loopctl.steering_drain` | Accepted guidance joins the next turn | `count` |
| `loopctl.model_switch` | The active model changes | `from`, `to` |
| `loopctl.transport_fallback` | A failed stream is recovered on the non-streaming transport | `turn` |
| `loopctl.salvage` | A salvage retry is armed toward shrinking | `kind` (`overflow`, `length_cut`), `turn`, `target_tokens` |
| `loopctl.cancelled` | The run ends by cancellation | `turn` |
| `loopctl.hook_followup` | A hook extends a clean run by one turn | `origin`, a hook-declared id |

The vocabulary is closed. The names ride `SIGNAL_EVENT_NAMES`, and a pin asserts every emitted name is in the table. None of them carry message content you did not opt into: names, counts, token figures, and model ids.

Figures are honest counts on one scale, the engine's provider-token figure. A pass where no compaction ran reports the conversation unchanged. A failed pass that measured reports its measured figures. Zeros appear only when nothing was ever measured.

The `outcome` is settled by the machine's own decision. You read `applied` only when the machine adopts the compacted history, and `noop` only when it accepts the unchanged feed.

## What you get out of it

You use this layer when you want to answer "what did the engine decide, and when" without reading the logs of every subsystem. A trace shows you the compaction that ran before the overflow rejection and the steering drain that fed turn four. Each sits at its own decision point.

Enable the exporters to ship it: [loopctl-otel](/telemetry/exporters/) for OTLP, [loopctl-langfuse](/telemetry/exporters/) for Langfuse. Or read the spans with any `tracing_subscriber` fmt layer at `loopctl=debug`.

## Related pages

- [Run metrics](/telemetry/metrics/): the numeric side of telemetry.
- [Compaction](/engine/compaction/): the passes the compaction signal narrates.
- [Steering](/engine/steering/): the drain the steering signal counts.
- [File reference: tracing_spans.rs](/file-reference/tracing-spans/)
