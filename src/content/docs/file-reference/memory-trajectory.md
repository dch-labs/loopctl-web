---
title: "src/memory/trajectory.rs and trajectory/sink.rs"
---

These files give you a ready-made `LoopObserver` that assembles every run into one serializable trajectory record. Sources: `src/memory/trajectory.rs` for the record types and observer, plus `src/memory/trajectory/sink.rs` for the background writer.

The record is the whole run as plain data: each turn's query and truncated response, every tool call paired by id, durations, token totals, and a three-way outcome.

Records are kept in memory, and they can also append as JSON Lines to a ledger file. Record types and the observer live in `src/memory/trajectory.rs`, and the background writer lives in `src/memory/trajectory/sink.rs`.

## Key items

`TrajectoryObserver::in_memory()` captures to memory only, and your finished records come out of `records()` oldest first.

`TrajectoryObserver::writing_to(dir)` additionally appends one JSONL line per run to `<dir>/trajectory.jsonl` through a background writer with a 128-record queue.

When that queue is full, the oldest queued record is dropped with a warning, so a slow disk never slows your run. `flush()` blocks until the queue drains, and dropping the observer drains it first.

`.with_capture_limit(chars)` sets how much response text each turn keeps, defaulting to 2,000 characters cut on char boundaries.

`.with_memory_retention(Some(n))` sets a FIFO cap on records held in memory. That is unbounded by default, and your ledger is unaffected.

`TrajectoryRecord` carries `session_id`, `run_id`, `outcome`, `started_at` in RFC 3339 whole seconds, and `duration_ms`.

It also carries `total_turns`, `token_summary`, and `turns` ordered by turn index.

`TrajectoryOutcome` is `Success` when the run ended clean whatever the tools did, `Failure` when it failed with no successful tool work, and `Partial` when it failed after real progress.

That is finer-grained than a `success: bool`.

`TrajectoryTurn` holds your turn index, query, response, tool calls, duration, and tokens. The query is tool-result text on continuation turns.

`TrajectoryToolCall` holds `tool_call_id`, tool name, `ok`, and `duration_ms`.

## Behavior notes

This is a pure listener. It never blocks, vetoes, or fails your run. Every capture failure is a warning, and the in-memory record survives any file-output failure.

A tool turn's `duration_ms` is the sum of the engine's two per-phase turn-end events, model phase and tool phase, so your full turn wall clock is kept. The repeated token totals are last-wins.

A retried tool call appears once per attempt, oldest first, because those entries are your recovery story. A call still in flight when the run ends renders `ok: false`, timed to the run end.

Out-of-order or partially observed event streams are absorbed, with one slot per turn index ordered by index.

The observer is thread-safe, being `Send + Sync`, but you should attach one observer per concurrently running loop. Overlapping runs on one observer discard the orphaned record, loudly.

The JSONL line is a stable interchange contract. Fields serialize in declaration order, outcomes are `snake_case`, and unknown fields are tolerated when you read.

The usage-detail fields in `token_summary` are reserved and always `null` in this version.

Your ledger content is plaintext prompts, responses, and tool text, so treat that directory as sensitive and plan rotation yourself, since it grows without bound.

Records still queued at abrupt process exit are lost, so drop the observer or call `flush()` for an orderly shutdown.

## The per-event ledger

Since 0.4.0 the sibling `trajectory/events.rs` adds a per-event ledger. `EventLedgerObserver` writes one `TrajectoryEvent` per engine event to `events.jsonl`.

There are eleven stable kinds, including `run.start`, `turn.start`, `tool.call`, `tool.result`, `gate.decision`, `compaction.*`, and `usage`. They are turn-scoped and joinable by `call_id`, and an unknown future kind parses with its envelope intact.

Both ledger files are created owner-only `0600` on unix.

For the deep dive, including the trajectory-capture section, see [Memory](/extensions/memory/), and for the ledger see [The event hub](/extensions/event-hub/).
