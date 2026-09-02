---
title: "`src/engine/core/lifecycle.rs` — the `Loop` trait and run records"
---


The engine's public contract plus the audit-trail data model.

**Key items**

- `Loop` — `run`, `should_continue`, `finalize`, `state`, `cancel`, `stop_reason` (default `None`); `RunResult = Result<Run, LoopError>`.
- `RunConfig` (`#[non_exhaustive]`): `max_turns: 200`, `parallel_tool_dispatch` (Sequential/8), `reset_managers: false`, `memory_top_k: 3`; builders `with_max_turns`, `with_parallel_dispatch`.
- `Run { id, start, end, turns, input, output, config, stop_reason }` + derived `turn_count`, `tool_call_count`, token sums, `duration`.
- `Session { id, config, runs }` — `current_run[_mut]`, `total_turns/duration/tokens`; `session.runs` is the audit trail (one `Run` per `run()` call).
- `Turn { turn, input, output, tool_calls, input_tokens, output_tokens }`.
- `TurnMode { NonStreaming, Streaming [streaming] }` + `default_turn_mode()` (feature-dependent); `ToolCall::apply_correction` also lives here.

**Behavior notes**

- `Run::start`/`end`/`stop_reason` and `Session::session_start` are `#[serde(skip)]` — process-local instants; everything durable serializes.
- Stop-reason mapping nuance: a stream `EndTurn` reply that *contains* tool calls is reported as `ToolCall`.
- Parallel wave planning types (`ToolDependencyGraph`, `DispatchPlan`) live with the dispatch code but describe per-turn policy set here.

Deep dives: [driver](/engine/driver-loop/) · [config](/core-data/session-config/).
