---
title: "src/metrics/layer.rs"
---

This file holds `MetricsLayer`, the `tracing_subscriber` layer that turns the crate's metric events into stored series. Behind the `metrics` feature.

## Key items

`MetricsLayer::TARGET` is the reserved target, `loopctl::metrics`, DEBUG only. `MetricsLayer::new(store)` takes an `Arc<MetricsRegistry>`, and you add it to any `tracing_subscriber` registry.

`METRIC_EXEMPT_FIELDS` lists fields that ride a metric event without being labels or drift, such as a message string.

## Behavior notes

The layer classifies every event you emit by the contract. `metric` names the series. An unknown name is counted as drift and stores nothing, so the store never holds data under an invented identity.

Four shape-drift counters ride the snapshot: `unknown_metric`, `unknown_labels`, `missing_labels`, and the counter-with-numerics count. The crate's own stream trips the last one deliberately, so a non-zero figure there is workload arithmetic rather than a diagnosis you must chase.

A duration field on a counter is drift, unless the field is named for the metric's own unit tail. The layer reads that one as the event's delta instead.

For the deep dive, see [Run metrics](/telemetry/metrics/).
