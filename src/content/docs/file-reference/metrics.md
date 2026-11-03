---
title: "src/metrics.rs"
---

This file is the module root of the run-metrics surface, behind the `metrics` feature. It wires the five submodules and re-exports the names you use.

## Key items

The module docs carry three runnable examples you can copy: assembling an `AgentMetrics` by hand, wiring a `MetricsLayer` over a `MetricsRegistry` store, and attaching a `MetricsObserver` to a loop.

Re-exports: `MetricsLayer` and `MetricsObserver`, the registry catalog of `REGISTRY`, `all`, `lookup`, `validate`, `MetricDescriptor`, and `MetricKind`. You also get the session types, `AgentMetrics`, `LatencyHistogram`, `Percentile`, `TokenTotals`, and `ToolStats`, plus the store types, `MetricsRegistry` and `RegistrySnapshot` and friends.

Two private helpers live here and set the tone. `lock` recovers a poisoned mutex for you. `wide_to_f64` converts `u64` to `f64` exactly below 2^53 and correctly rounded beyond, so ratios you build keep their magnitude past `u32::MAX`.

## Behavior notes

Both collectors are inert until you wire them. The layer needs a subscriber that admits its target at DEBUG, and the observer needs `with_observer` on your loop.

Nothing here fabricates a number for you. Every read returns `None` until its signal has data. When you serialize a snapshot, partial JSON reads as defaults, so an old blob still loads.

For the deep dive, see [Run metrics](/telemetry/metrics/).
