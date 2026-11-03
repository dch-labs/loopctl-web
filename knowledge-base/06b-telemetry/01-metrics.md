# Run metrics

Metrics are the typed numbers a run produces: turns, latency, tokens, tool calls, and cost inputs. loopctl ships the value types, a catalog of every metric name, and two collectors that fill them. Enable the `metrics` feature to get all of it. Source: `src/metrics.rs` and `src/metrics/`.

Four surfaces ride the feature:

| Surface | What it is |
|---|---|
| `session::AgentMetrics` | The typed per-run snapshot: turn counts, latency percentiles, per-tool stats, token totals |
| `registry` | The static catalog of every metric name, its kind, and its closed label set |
| `store::MetricsRegistry` | The live value store: one series per name plus label set, read as a snapshot |
| `MetricsLayer` and `MetricsObserver` | The two collectors: one eats the engine's metric events, one eats its callbacks |

Added in 0.5.0.

## The session snapshot

`AgentMetrics` is what one run looks like as data. You can fill it with `MetricsObserver`, or assemble it yourself and ship it anywhere.

```rust
use loopctl::metrics::{AgentMetrics, TokenTotals};

let mut m = AgentMetrics::default();
m.total_turns = 2;
m.turn_latency.record(300);
m.turn_latency.record(400);
m.tokens.add(TokenTotals {
    input: 800,
    output: 90,
    ..Default::default()
});
m.record_tool("read", 5, false);

let p = m.turn_latency_percentiles().expect("turns recorded");
assert_eq!(p.p50.value_ms, 500);
```

Notice what the percentile read gives you. Both samples land in the same fixed bucket, so `p50` reports that bucket's upper bound, 500 ms. Percentile reads are conservative estimates, which is the right claim for an SLO.

The histogram scheme covers 5 ms to 60 s in fixed buckets, with one overflow slot past the top. A `Percentile` carries `overflow: bool`, so a p99 read above the top bucket says so instead of pretending it fit.

Every counter saturates rather than wraps. The snapshot serde round-trips with forward-compatible defaults, so partial JSON reads as defaults. The tool map is a `BTreeMap`, so your export diffs stay stable.

`TokenTotals` carries the detail classes: `input`, `output`, `cached_input`, `cache_write`, and `reasoning`, plus derived reads such as `cache_hit_rate()` and `reasoning_share()`. Turn counts, fallbacks, model switches, budget warnings, and both guardrail detectors have their own counters.

## The metric catalog

The registry declares every metric name the telemetry contract knows: 65 rows today. Each row is a `MetricDescriptor` with a name, a kind, and a closed label set.

| `MetricKind` | Meaning |
|---|---|
| `Counter` | A monotonic count |
| `Gauge` | An instantaneous reading that can move either way |
| `Histogram` | Samples in fixed buckets |

Names follow one grammar: `loopctl.<subsystem>.<name>[.<unit>]`. Look a name up, and validate an emission against its declaration.

```rust
use loopctl::metrics::registry;

let d = registry::lookup("loopctl.tools.calls").expect("declared name");
assert_eq!(d.labels, ["tool", "outcome"]);

// An emission must carry exactly the declared label set.
assert!(registry::validate("loopctl.embed.requests", &["provider", "outcome"]).is_some());
assert!(registry::validate("loopctl.embed.requests", &["provider"]).is_none());
```

Validation is exact. Extra labels, missing labels, and a label carried twice all refuse. So an undeclared name or shape is a counted gap, never data stored under an invented identity.

Every declared row has at least one emission site in the crate, and `tests/registry_emission_audit.rs` fails the build if a future row ships unwired. That is what makes silence an answer: an empty series means the thing did not happen.

## The collectors

### MetricsLayer

`MetricsLayer` is a `tracing_subscriber` layer. It watches the reserved target `loopctl::metrics` at DEBUG and turns recognized events into store series. It is inert until you compose it into a subscriber, and the filter must admit the target or the layer never sees an event.

```rust
use std::sync::Arc;
use loopctl::metrics::{MetricsLayer, MetricsRegistry};
use tracing_subscriber::layer::SubscriberExt as _;

let store = Arc::new(MetricsRegistry::default());
let subscriber = tracing_subscriber::registry()
    .with(MetricsLayer::new(store.clone()))
    .with(
        tracing_subscriber::filter::Targets::new()
            .with_target(MetricsLayer::TARGET, tracing::Level::DEBUG),
    );
let _guard = tracing::subscriber::set_default(subscriber);
```

Install the layer before the engine's first emission. `tracing` caches per-callsite interest against the default subscriber, so a late install misses events.

An event whose name the catalog does not declare is counted as drift and stores nothing. Four shape-drift counters track mismatches such as a label an event carries that its row does not declare. Read them off the snapshot to spot a crate and a dashboard drifting apart.

### MetricsObserver

`MetricsObserver` implements `LoopObserver` and fills an `AgentMetrics` from engine callbacks. Attach it like any observer.

```rust
use std::sync::Arc;
use loopctl::metrics::MetricsObserver;

let observer = Arc::new(MetricsObserver::default());
let mut agent = BareLoop::new(client, registry, config)
    .with_observer(observer.clone());
```

Read `observer.snapshot()` after the run for the filled `AgentMetrics`. Every read returns `None` until its signal has data, and a metric nobody emitted never fabricates a number.

## Reading the rows honestly

Four rows deserve their fine print before you build a panel on them.

| Row | Fine print |
|---|---|
| `compaction.headroom_pct` | Percent, 0 to 100. The `CompactTelemetry::headroom_pct` field keeps its own 0.0 to 1.0 fraction. Both scales are documented at both sites. |
| `reasoning.blocks` | Counted per block per request at wire conversion, so its value is a rate across requests. |
| `attachments.count` and `attachments.tokens_estimate` | Recorded per kind at the consolidation seam. A kind with nothing pinned records zero, so the gauge clears instead of holding its last value. |
| `tools.first_calls` and `think.first_in_turn` | Their marks live on the loop and survive a tool's deregistration and re-registration. |

Two duration rows run on the process's own monotonic clock: `memory.extract.duration_ms` and `memory.persist.flush.duration_ms`. Each says so in the docs of the function that emits it. The other durations follow the determinism clock seam, so a replayed run reports the same numbers.

## The example

Run the telemetry example to see both collectors over one mock-backed run.

```sh
cargo run --example telemetry --features metrics,testing
```

It prints every catalog series the engine's events produced, the four drift counters, and the observer's per-run totals. Nothing reaches the network, and no figure is invented. The example doubles as a live check that a declared row is still being fed.

## Related pages

- [The span tree](02-spans.md): the trace side of telemetry.
- [Observers](../04-extensions/01-observers.md): the callback surface `MetricsObserver` implements.
- [Prices and cost](04-pricing.md): what the token totals buy you.
- [File reference: metrics.rs](../07-file-reference/metrics.md)
