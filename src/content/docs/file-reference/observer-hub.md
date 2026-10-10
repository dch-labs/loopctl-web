---
title: "`src/observer/hub.rs` — `EventHub`, the observer-to-broadcast adapter"
---


One `LoopObserver` feeding a broadcast stream: register the hub as an observer, subscribe from anywhere — many consumers, other tasks, a CLI rendering an attached run.

**Key items**

- `EventHub::new(capacity)` — the bounded broadcast channel; `subscribe()` hands out receivers freely.
- `LoopEvent` — one variant per engine event, each carrying the observer context's payload; `#[non_exhaustive]` with an `Unknown` variant that forwards future kinds' raw envelopes (an old consumer never breaks on a new event).
- `ObservedEvent` — the envelope: the event plus run/turn metadata and the hub's emission sequence.

**Behavior notes**

- **Lagged receivers are dropped, not buffered**: the channel is bounded and a slow consumer that falls behind loses the oldest events — the hub favors the live run over the laggard. A consumer that must not miss anything persists from the event ledger (`memory::trajectory`'s `EventLedgerObserver`, `events.jsonl`) instead.
- The hub forwards the new 0.4.0 events too — `GateDecision`, `BudgetWarn`, `PreCompaction`, `CompactionFailed`, `AttemptReset` — each mapped to its kind in call order.

Deep dive: [The event hub](/extensions/event-hub/)
