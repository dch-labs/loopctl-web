# `crates/langfuse/`

This crate is `loopctl-langfuse`, the Langfuse export companion: it renders runs as Langfuse traces, observations, and scores. It depends on `loopctl` by path with an exact version pin and re-exports nothing from core.

## Key items

One `agent.run` span becomes one trace with `session_id` grouping. An `agent.turn` becomes an observation of kind `generation` carrying model and usage. An `agent.tool` becomes an observation beside its turn.

`AgentMetrics` rollups land as scores on the trace, and `mapping.rs` holds the field translation.

Transport is the batched-ingest REST API, `POST /api/public/ingestion` with Basic auth: background batching, stable event ids, retry with backoff.

## Behavior notes

The guard's drop closes the queue with a bounded flush. On a current-thread runtime the drop does not wait, so await `LangfuseGuard::flush` before the runtime stops.

The ingestion endpoint is the legacy one, which Langfuse v3 and v4 in `legacy` or `dual` write mode accept. Cloud and self-hosted differ only by `host`.

`prompt_never_ships` is the crate's own gate test: prompt content never reaches the export, matching the core's content policy.

For the deep dive, see [Telemetry exporters](../06b-telemetry/03-exporters.md).
