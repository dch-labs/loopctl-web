# Telemetry exporters

Two companion crates ship the telemetry out: `loopctl-otel` for OpenTelemetry and `loopctl-langfuse` for Langfuse. The core emits, these deliver, and neither re-exports core. Both depend on `loopctl` by path with an exact version pin, so your host and the exporter resolve one copy of the types.

Both crates are new. Added in 0.5.0.

## loopctl-otel

`loopctl-otel` bridges the engine's spans to an OTLP pipeline. It renames spans per the OTel GenAI conventions, derives span status from the recorded outcome fields, and transports everything to Jaeger, Tempo, or Honeycomb.

It bridges rather than translates. loopctl's emitters already carry spec-shaped attribute names, and the crate's mapping is an identity proof on those names. The renames are the ones the conventions ask for: `invoke_agent` for a run, `execute_tool <tool>` for a tool span.

You install it in one call or compose it:

```rust
use loopctl_otel::{OtelConfig, OtelMetricsMode};

let guard = loopctl_otel::install(&OtelConfig {
    service_name: "my-agent".into(),
    // endpoint, sampling, and metrics mode...
    ..Default::default()
})?;
```

`install()` composes the layer, an OTLP exporter, and a `loopctl=DEBUG` target filter onto the global subscriber, all-or-nothing. Hosts with their own subscriber compose `otel_layer()` instead.

Metrics ride two ways. The closing `invoke_agent` span is stamped with the `AgentMetrics` rollup, and in `OtelMetricsMode::SpanAttributes` the subsystem registry rides along. `export_metrics` also replays a `RegistrySnapshot` into an OTLP metrics pipeline for Prometheus and Grafana stacks.

## loopctl-langfuse

`loopctl-langfuse` exports runs in Langfuse's native model.

| loopctl | Langfuse |
|---|---|
| One `agent.run` span | One trace, with `session_id` grouping runs |
| `agent.turn` span | An observation of kind `generation`, with model and usage |
| `agent.tool` span | An observation under the run, beside its turn |
| `AgentMetrics` rollup | Scores on the trace |

Transport is Langfuse's batched-ingest REST API with background batching, stable event ids, retry with backoff, and a bounded flush when the guard drops. On a current-thread runtime the guard closes the queue without waiting, so await `LangfuseGuard::flush` before the runtime stops.

Cloud and self-hosted differ only by `host`. The ingestion endpoint is the legacy one: Langfuse v3, and v4 in `legacy` or `dual` write mode, accept it.

## Picking between them

Use `loopctl-otel` when your stack already speaks OTLP or you want raw traces next to your other services. Use `loopctl-langfuse` when your team lives in Langfuse and wants runs as traces with scores, prompt analytics included.

Both read the same emissions, so you can run both at once over one subscriber if you need to.

## Related pages

- [The span tree](02-spans.md): what these crates export.
- [Run metrics](01-metrics.md): the rollups and snapshots they carry.
- [File reference: loopctl-otel](../07-file-reference/otel-crate.md) and [loopctl-langfuse](../07-file-reference/langfuse-crate.md)
