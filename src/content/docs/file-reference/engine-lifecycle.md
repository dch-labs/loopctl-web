---
title: "src/engine/core/lifecycle.rs"
---

This file is your engine's public contract plus the audit-trail data model. Read it when you want to know what a finished run leaves behind.

## Key items

Your `Loop` trait asks for `run`, `should_continue`, `finalize`, `state`, `cancel`, and `stop_reason`, where the last defaults to `None`. The alias `RunResult = Result<Run, LoopError>` is what your callers match on.

`RunConfig` is `#[non_exhaustive]` and ships `max_turns: 200` and `parallel_tool_dispatch` at Sequential/8.

It also ships `reset_managers: false`, whose builder `with_reset_managers` arrived in 0.4.0, plus `memory_top_k: 3`.

`memory_include_provider_derived: false` came in 0.3.2, so entries tagged `provider-derived` stay out of injection unless you opt in through `with_memory_include_provider_derived`. Your other builders are `with_max_turns` and `with_parallel_dispatch`.

`Run { id, start, end, turns, input, output, config, stop_reason }` derives `turn_count`, `tool_call_count`, token sums, and `duration`.

`Session { id, config, runs }` gives you `current_run` and `current_run_mut` plus totals for turns, duration, and tokens. Your `session.runs` is the audit trail, one `Run` per `run()` call.

`Turn { turn, input, output, tool_calls, input_tokens, output_tokens, stop_reason, transport_fallback }` carries the last two since 0.4.0, with `stop_reason` serde-defaulted.

`TurnMode { NonStreaming, Streaming [streaming] }` pairs with `default_turn_mode()`, which depends on your features. `ToolCall::apply_correction` also lives here.

## Behavior notes

`Run::start`, `Run::end`, `Run::stop_reason`, and `Session::session_start` are `#[serde(skip)]`, since they are process-local instants. Everything durable serializes.

Mind one stop-reason nuance: a stream `EndTurn` reply that contains tool calls is reported as `ToolCall`.

Your parallel wave planning types, `ToolDependencyGraph` and `DispatchPlan`, live with the dispatch code but describe the per-turn policy you set here.

Deep dives: [driver](/engine/driver-loop/) · [config](/core-data/session-config/).
