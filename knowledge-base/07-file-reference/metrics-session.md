# `src/metrics/session.rs`

This file holds the typed per-run snapshot and its parts: `AgentMetrics`, `LatencyHistogram`, `Percentile`, `TokenTotals`, and `ToolStats`. Behind the `metrics` feature.

## Key items

`AgentMetrics` carries run identity and outcome, settled-turn counts, a turn-latency histogram, per-tool stats in a `BTreeMap`, token totals, and counters for streams, compactions, fallbacks, transport downgrades, model switches, budget warnings, and both guardrail detectors.

`LatencyHistogram` covers roughly 5 ms to 60 s in fixed buckets with one overflow slot. `turn_latency_percentiles()` reads p50, p90, and p99 as bucket-upper-bound estimates.

`TokenTotals` sums `input`, `output`, `cached_input`, `cache_write`, and `reasoning`, with derived reads `total()`, `cache_hit_rate()`, and `reasoning_share()`.

## Behavior notes

A `Percentile` carries `overflow: bool`, so a sample above the top bucket identifies itself instead of reading as the bound.

Every counter add saturates rather than wraps. Serde round-trips with forward-compatible defaults, so a partial or older JSON blob reads as defaults, and a missing run uuid reads nil.

Percentile reads are conservative, the right claim for an SLO.

For the deep dive, see [Run metrics](../06b-telemetry/01-metrics.md).
