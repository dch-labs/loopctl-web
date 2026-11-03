# `crates/otel/`

This crate is `loopctl-otel`, the OpenTelemetry export companion: it bridges the engine's spans to an OTLP pipeline. It depends on `loopctl` by path with an exact version pin and re-exports nothing from core.

## Key items

`install(&OtelConfig)` composes the layer, an OTLP exporter, and a `loopctl=DEBUG` target filter onto the global subscriber, all-or-nothing, and returns a `ShutdownGuard`. Hosts with their own subscriber compose `otel_layer` instead.

`mapping.rs` renames spans per the OTel GenAI conventions, `invoke_agent` and `execute_tool <tool>`, and `otel_attribute` is the identity proof on the spec-shaped names loopctl already emits.

`export_metrics` replays a `RegistrySnapshot` into an OTLP metrics pipeline, and `OtelMetricsMode::SpanAttributes` stamps the `AgentMetrics` rollup on the closing `invoke_agent` span.

## Behavior notes

The crate derives span status from the recorded `outcome` and `error.type` fields rather than inventing its own.

Claiming the global subscriber is the only fallible install step, and it runs before any OTel global moves, so a failed install leaves no half-wired pipeline.

The guard's drop flushes and shuts down, so a short-lived host loses nothing on exit.

For the deep dive, see [Telemetry exporters](../06b-telemetry/03-exporters.md).
