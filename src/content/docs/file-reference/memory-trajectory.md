---
title: "`src/memory/trajectory.rs` + `trajectory/sink.rs` — `TrajectoryObserver`"
---


A ready-made `LoopObserver` that assembles every run into one serializable **trajectory record** — the whole run as plain data: each turn's query and (truncated) response, every tool call paired by id, durations, token totals, and a three-way outcome. Records are kept in memory and can also append as JSON Lines to a ledger file. Sources: `src/memory/trajectory.rs` (record types + observer), `src/memory/trajectory/sink.rs` (background writer).

**Key items**

- `TrajectoryObserver::in_memory()` — capture to memory only; finished records come out of `records()` (oldest first).
- `TrajectoryObserver::writing_to(dir)` — additionally appends one JSONL line per run to `<dir>/trajectory.jsonl` through a background writer (128-record queue; when full, the oldest queued record is dropped with a warning — a slow disk never slows a run). `flush()` blocks until the queue drains; dropping the observer drains it first.
- `.with_capture_limit(chars)` — how much response text each turn keeps (default 2,000 characters, cut on char boundaries).
- `.with_memory_retention(Some(n))` — FIFO cap on records held in memory (default unbounded; the ledger is unaffected).
- `TrajectoryRecord` — `session_id`, `run_id`, `outcome`, `started_at` (RFC 3339, whole seconds), `duration_ms`, `total_turns`, `token_summary`, `turns` (ordered by turn index).
- `TrajectoryOutcome` — `Success` (run ended clean, whatever the tools did), `Failure` (failed with no successful tool work), `Partial` (failed after real progress) — finer than `success: bool`.
- `TrajectoryTurn` — turn index, query (tool-result text on continuation turns), response, tool calls, duration, tokens.
- `TrajectoryToolCall` — `tool_call_id`, tool name, `ok`, `duration_ms`.

**Behavior notes**

- Pure listener: never blocks, vetoes, or fails a run; every capture failure is a warning, and the in-memory record survives any file-output failure.
- A tool turn's `duration_ms` is the sum of the engine's two per-phase turn-end events (model phase + tool phase), so the full turn wall clock is kept; the repeated token totals are last-wins.
- A retried tool call appears once per attempt, oldest first — the entries are the recovery story. A call still in flight when the run ends renders `ok: false`, timed to the run end.
- Out-of-order or partially observed event streams are absorbed: one slot per turn index, ordered by index.
- Thread-safe (`Send + Sync`) — but attach **one observer per concurrently running loop**. Overlapping runs on one observer discard the orphaned record, loudly.
- The JSONL line is a stable interchange contract: fields serialize in declaration order, outcomes are `snake_case`, unknown fields are tolerated when reading; the usage-detail fields in `token_summary` are reserved and always `null` in this version.
- Ledger content is plaintext prompts, responses, and tool text — treat the directory as sensitive, and plan rotation yourself (it grows without bound). Records still queued at abrupt process exit are lost; drop the observer or call `flush()` for an orderly shutdown.

Deep dive: [Memory](/extensions/memory/) — including the trajectory-capture section.
