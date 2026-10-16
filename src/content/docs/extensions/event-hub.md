---
title: "The event hub"
sidebar:
  order: 6
---

An [observer](/extensions/observers/) is the engine's push mechanism, but it has one shape. Callbacks, called synchronously, into one observer list.

You need a subscribable stream when you want many consumers. Picture a TUI, a metrics collector, and a logger all watching one run. Your consumers may also live in other tasks, such as a CLI process rendering a run it attached to.

`EventHub` in `src/observer/hub.rs` is that stream. It is one observer that fans every engine event into a broadcast channel.

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

The three types, and the rule that keeps them open-ended:

- **`EventHub`** is the observer half. Register it like any other observer, and it translates each callback into one event and broadcasts.

- Lagged receivers are dropped rather than buffered. The channel is bounded, and you choose the capacity, so a slow consumer that falls behind loses the oldest events.

- The hub favors your live run over the laggard. A TUI that must not miss anything persists from the ledger instead, described below.

- **`LoopEvent`** is the stream vocabulary. There is one variant per engine event, and each carries the same payload the observer context carried.

- The variants cover `RunStarted`, `TurnStarted`, `TextDelta`, `ThinkingDelta`, `ToolCall`, `ToolResult`, `GateDecision`, and `TurnEnded`, plus the `Compaction*` and `Fallback*` families, `ModelSwitched`, and `BudgetWarn`.

- That enum is `#[non_exhaustive]`, and the `Unknown` variant forwards an unknown kind's raw envelope. That is how an old consumer survives a new event without breaking.

- **`ObservedEvent`** is the envelope: the event plus the observing metadata, meaning which run/turn it belongs to and its sequence within the hub's emission.

## The sibling: the per-event ledger

The hub is your live stream, and `EventLedgerObserver` in `memory::trajectory` is the durable one. Register it instead, or alongside, and every event lands as one JSONL line in `events.jsonl`.

Each line is a `TrajectoryEvent` with a stable `kind` from the serde-renamed `TrajectoryEventKind` table, such as `run.start`, `turn.start`, `tool.call`, `tool.result`, `gate.decision`, the `compaction.*` kinds, and `usage`. Each line also carries turn scoping and a `data` payload per kind.

The ledger is your interchange format for replay, audit, and the cassette-era tooling:

- A `gate.decision` row joins its `tool.call` and `tool.result` rows by `call_id`, which gives you the audit trail of who decided what.

- A `usage` row carries the token counts for one turn.

- Unknown future kinds still parse with their envelope intact, pinned by `an_unknown_future_kind_still_parses`. Two census pins keep the documented kinds table from drifting: every emitted kind has a table row, and conversely every table row is emitted.

Both ledger files, `trajectory.jsonl` and `events.jsonl`, are created owner-only `0600` on unix.

## Hub or ledger or plain observer?

| Need | Use |
|---|---|
| One consumer, in-process, simple | A plain `LoopObserver` |
| Many consumers, or consumers in other tasks | `EventHub` plus `subscribe()` |
| Durable, replayable, joinable-by-id records | `EventLedgerObserver`, which writes JSONL |
| Both a live UI and a durable trail | Both, because each is just an observer |

## Related pages

- [Observers](/extensions/observers/) covers the callback surface the hub adapts.
- [Memory](/extensions/memory/) covers the run-level records beside your event-level ledger.
- [Determinism](/file-reference/determinism/) covers the seams that make a replayed run's events byte-stable.
- [observer/hub.rs, file reference](/file-reference/observer-hub/) is the source-level detail.
