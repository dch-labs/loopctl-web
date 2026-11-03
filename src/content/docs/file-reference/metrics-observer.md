---
title: "src/metrics/observer.rs"
---

This file holds `MetricsObserver`, the `LoopObserver` that fills an `AgentMetrics` snapshot from engine callbacks. Behind the `metrics` feature.

## Key items

`MetricsObserver::default()` then `BareLoop::with_observer(Arc::new(..))` attaches it. `snapshot()` returns the filled `AgentMetrics` you read after the run.

It implements the callback surface end to end. You get run start and end, turn end, stream success and failure, tool post, compaction and its failure, fallback and transport fallback, model switch, budget warn, and both guardrail detections.

## Behavior notes

Per-tool stats count attempts, so a retry is an attempt. The error numerator and per-attempt latency ride the same `ToolStats`.

Turn latency records at turn end, and token totals add the turn's usage detail, cache and reasoning classes included.

The snapshot starts empty and fills as your run proceeds, so a read before the run returns defaults rather than guesses. Use it when you want the run's own view of itself without wiring any tracing.

For the deep dive, see [Run metrics](/telemetry/metrics/).
