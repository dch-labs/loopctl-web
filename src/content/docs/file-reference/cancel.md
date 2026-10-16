---
title: "src/cancel.rs"
---

This file holds your cooperative cancellation flag, shareable as `Arc<CancelSignal>` and honored at every level of your engine.

## Key items

`cancel()` fires your signal. It is idempotent and wakes all waiters.

`is_cancelled()` lets you poll without blocking.

`notified().await` gives you a race-free async wait that completes immediately if someone already fired.

`reset()` swaps in a fresh token, because the underlying tokio `CancellationToken` is one-shot by design.

## Behavior notes

This wraps `tokio_util::sync::CancellationToken` precisely to avoid the check-then-act race you inherit from hand-rolled `AtomicBool` plus `Notify`.

Your engine re-arms in `finalize()`, after the run observed the cancel, so a cancel arriving between runs is observed by exactly one run and then cleared. One cancel can never permanently kill an agent.

A task already waiting on the old token when `reset()` happens still completes against the old fired token, so keep your waits short.

Lock poisoning is recovered here. The data is a single value, so the `recover_guard` policy applies.

Deep dive: [Cancellation](/engine/cancellation/).
