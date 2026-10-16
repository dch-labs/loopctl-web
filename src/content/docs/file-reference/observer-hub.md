---
title: "src/observer/hub.rs"
---

This file holds `EventHub`, an adapter that turns one `LoopObserver` into a broadcast stream. You register the hub as an observer and subscribe from anywhere.

That gives you many consumers, in other tasks, such as a CLI rendering an attached run.

## Key items

`EventHub::new(capacity)` builds your bounded broadcast channel, and `subscribe()` hands out receivers to you freely.

`LoopEvent` has one variant per engine event, each carrying the observer context's payload. It is `#[non_exhaustive]` with an `Unknown` variant that forwards future kinds' raw envelopes, so an old consumer never breaks on a new event.

`ObservedEvent` is the envelope you receive: the event plus run/turn metadata and the hub's emission sequence.

## Behavior notes

Lagged receivers are dropped, not buffered. The channel is bounded, so a slow consumer that falls behind loses its oldest events, because the hub favors the live run over the laggard.

A consumer that must not miss anything persists from the event ledger instead, which is `memory::trajectory`'s `EventLedgerObserver` writing `events.jsonl`.

You also get the new 0.4.0 events forwarded: `GateDecision`, `BudgetWarn`, `PreCompaction`, `CompactionFailed`, and `AttemptReset`, each mapped to its kind in call order.

For the deep dive, see [The event hub](/extensions/event-hub/).
