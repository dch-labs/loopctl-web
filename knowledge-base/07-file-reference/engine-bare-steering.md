# src/engine/bare/steering.rs

This file holds the `Steering` slot behind `BareLoop::steering()`, the guidance handle you push to from outside a running loop. Added in 0.4.1.

## Key items

Your handle is an `Arc<Steering>` you clone like the cancel signal. Call `push(Message) -> bool` to offer guidance. It returns false when no run is in flight, and acceptance and the in-flight check share one lock.

Call `is_empty` to peek. Use `take_leftovers` to collect the sealed pocket alone, `take_all` for the shutdown collect of sealed plus waiting, and `clear` to drop everything.

The internal `Slot { running, waiting, leftovers }` sits under one mutex, so acceptance, draining, and sealing never interleave.

A `SteeringCloseGuard` is created beside `open_run`. It closes the slot when the run future is dropped, through abort, timeout, or `select!`, and composes idempotently with `finalize`'s close.

## Behavior notes

The loop drains the slot at each turn boundary through `LoopMachine::inject`, so your guidance enters the pending set the machine commits. A push during dispatch lands in the next request, after the tool results. Three pushes land in order as separate user messages.

Leftovers survive cancellation and are sealed by the next run's opening, never delivered. Advice about a turn that no longer stands is not advice.

A drain that takes anything invalidates the stashed prepared turn and the usage anchor, exactly as a rewind does. It also sits ahead of the pre-request re-measure, so a large push moves the context figure before the next threshold decision.

Deep dive: [Steering](../02-engine/10-steering.md).
