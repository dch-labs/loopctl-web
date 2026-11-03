# `src/metrics/store.rs`

This file holds `MetricsRegistry`, the live value store: one `MetricValue` per name plus label-set series, read as a `RegistrySnapshot`. Behind the `metrics` feature.

## Key items

`counter_add`, `gauge_set`, and `histogram_record` write through the kind the descriptor declared. `snapshot()` returns the whole store as one `RegistrySnapshot`.

`SeriesSnapshot` and `SeriesValue` carry one series each, sorted by name then labels. `HistogramSummary` summarizes a histogram's buckets.

`derived(name)` computes a derived reading such as `memory.demotion_roi` from the stored series.

## Behavior notes

Two scrapes of an unchanged store produce byte-equal payloads, because the order is `BTreeMap` key order rather than insertion order. Diff-based exporters rely on that.

The four diagnostic counters ride the snapshot: `unknown_metric`, `unknown_labels`, `missing_labels`, and the counter-with-numerics count. An emission under a partial label set is refused, so the stored shape cannot fork from the declared one.

A counter add saturates instead of exiting without adding, and a histogram's bucket bounds travel with their counts through serde in whatever order the wire sends.

For the deep dive, see [Run metrics](../06b-telemetry/01-metrics.md).
