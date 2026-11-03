# `src/metrics.rs`

This file is the module root of the run-metrics surface, behind the `metrics` feature. It wires the five submodules and re-exports the names you use.

## Key items

The module docs carry three runnable examples: assembling an `AgentMetrics` by hand, wiring a `MetricsLayer` over a `MetricsRegistry` store, and attaching a `MetricsObserver` to a loop.

Re-exports: `MetricsLayer`, `MetricsObserver`, the registry catalog (`REGISTRY`, `all`, `lookup`, `validate`, `MetricDescriptor`, `MetricKind`), the session types (`AgentMetrics`, `LatencyHistogram`, `Percentile`, `TokenTotals`, `ToolStats`), and the store types (`MetricsRegistry`, `RegistrySnapshot`, and friends).

Two private helpers live here and set the tone: `lock` recovers a poisoned mutex, and `wide_to_f64` converts `u64` to `f64` exactly below 2^53 and correctly rounded beyond, so ratios keep their magnitude past `u32::MAX`.

## Behavior notes

Both collectors are inert until wired. The layer needs a subscriber that admits its target at DEBUG, and the observer needs `with_observer` on the loop.

Nothing here fabricates a number. Every read returns `None` until its signal has data.

For the deep dive, see [Run metrics](../06b-telemetry/01-metrics.md).
