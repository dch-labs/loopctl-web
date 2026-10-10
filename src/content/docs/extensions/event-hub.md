---
title: "The event hub — observers to a broadcast stream"
sidebar:
  order: 6
---


An [observer](/extensions/observers/) is the engine's push mechanism, but it has one shape: callbacks, called synchronously, one observer list. When you need *many* consumers (a TUI **and** a metrics collector **and** a logger), or consumers in *other tasks* (a CLI process rendering a run it attached to), you need a stream you can subscribe to. That's `EventHub` (`src/observer/hub.rs`): one observer fanning every engine event into a broadcast channel.

---

## The shape

```rust
use loopctl::observer::EventHub;
use futures::StreamExt;

let hub = EventHub::new(256);                     // bounded channel capacity
agent.register_observer(Arc::new(hub));           // it IS an observer

let mut rx = hub.subscribe();                     // any number of receivers
tokio::spawn(async move {
    while let Ok(event) = rx.recv().await {
        match event.kind {                        // LoopEvent — one variant per engine event
            // handle what you care about; Unknown carries future kinds' envelopes
            _ => {}
        }
    }
});
```

Three types:

- **`EventHub`** — the observer half. Register it like any observer; it translates each callback into one event and broadcasts. **Lagged receivers are dropped, not buffered**: the channel is bounded (capacity is yours), and a slow consumer that falls behind loses the oldest events — the hub's contract favors the live run over the laggard. A TUI that must not miss anything persists from the ledger (below) instead.
- **`LoopEvent`** — the stream vocabulary: one variant per engine event (`RunStarted`, `TurnStarted`, `TextDelta`, `ThinkingDelta`, `ToolCall`, `ToolResult`, `GateDecision`, `TurnEnded`, `Compaction*`, `Fallback*`, `ModelSwitched`, `BudgetWarn`, ...), each carrying the same payload the observer context carried. `#[non_exhaustive]` — an `Unknown` variant forwards future kinds' raw envelopes so an old consumer never breaks on a new event.
- **`ObservedEvent`** — the envelope: the event plus the observing metadata (which run/turn it belongs to, sequence within the hub's emission).

## The sibling — the per-event ledger

The hub is the *live* stream; **`EventLedgerObserver`** (`memory::trajectory`) is the *durable* one. Register it instead (or alongside) and every event lands as one JSONL line in `events.jsonl` — a `TrajectoryEvent` with a stable `kind` (the serde-renamed `TrajectoryEventKind` table: `run.start`, `turn.start`, `tool.call`, `tool.result`, `gate.decision`, `compaction.*`, `usage`, ...) plus turn scoping and a `data` payload per kind. The ledger is the interchange format for replay, audit, and the cassette-era tooling:

- **`gate.decision`** rows join their `tool.call`/`tool.result` rows by `call_id` — the audit trail of who decided what.
- **`usage`** rows carry the token counts per turn.
- Unknown future kinds still parse with their envelope intact (`an_unknown_future_kind_still_parses`), and two census pins keep the documented kinds table from drifting: every emitted kind has a table row and conversely.

Both ledger files (`trajectory.jsonl`, `events.jsonl`) are created owner-only `0600` on unix.

## Hub or ledger or plain observer?

| Need | Use |
|---|---|
| One consumer, in-process, simple | a plain `LoopObserver` |
| Many consumers, or consumers in other tasks | `EventHub` + `subscribe()` |
| Durable, replayable, joinable-by-id records | `EventLedgerObserver` (JSONL) |
| Both (live UI + durable trail) | both — they're both just observers |

---

## Related pages

- [Observers](/extensions/observers/) — the callback surface the hub adapts.
- [Memory: trajectory capture](/extensions/memory/) — the run-level records beside the event-level ledger.
- [Determinism](/file-reference/determinism/) — the seams that make a replayed run's events byte-stable.
- [File reference: observer/hub.rs](/file-reference/observer-hub/)
