---
title: "Steering"
sidebar:
  order: 10
---

You are watching a live transcript. The agent is about to read a generated file, or restart the service you are logged into. You know something the model does not.

**Steering** is the seam that lets you say it. You hold a cloneable handle from outside the loop, and the loop drains your guidance at the next turn boundary into committed history. Added in 0.4.1. Source: `src/engine/bare/steering.rs`.

## The handle

`BareLoop::steering()` hands you an `Arc<Steering>`, shared the way the [cancel signal](/engine/cancellation/) is shared. The task driving a session lives inside `run()`'s borrow. You call a steering seam from outside the loop, never on it.

```rust
let steering = agent.steering();          // clone me into your UI task
let accepted = steering.push(Message::user(
    "src/generated.rs is generated. Do not edit it."));
```

`push` returns `false` when no run is in flight. Acceptance and the in-flight check share one lock, so an idle push is refused atomically and your message stays yours.

## Boundary, not interruption

Guidance is a turn-boundary event. A push during dispatch is absent from the request whose tools are running, and present in the next one, after the tool results that opened the boundary. Three pushes land in push order as separate user messages in history.

The conversation the user reads is the one the model continues. The loop drains the slot through the machine's own `inject` into the pending set the machine commits.

That is the property the [contributor](/extensions/contributors/) path deliberately cannot offer. A contributor's message rides one request and never persists.

## Leftovers belong to you

Guidance the run never reached stays in the slot, in order. Collect it with `take_leftovers()`, or drop it with `clear()`.

The next run does not deliver it. A run that starts seals the pocket, because advice about a turn that no longer stands is not advice. Suppose the user cancelled and edited their prompt between runs. The sealed guidance describes a conversation that is gone.

| Method | Reads | Steals live guidance? |
|---|---|---|
| `take_leftovers()` | the sealed pocket alone | no |
| `take_all()` | sealed plus waiting | yes, the shutdown collect |
| `clear()` | drops everything | yes |

Call `take_all()` only at shutdown.

## What a drain invalidates

A drain that takes anything drops the stashed prepared turn and the usage anchor, exactly as a [rewind](/engine/history-rewind/) does. A gated selector proves the point: a push landing in the turn-0 preparation window forces the stash to rebuild with the guidance in view, and the first request carries it.

The drain also sits ahead of the pre-request re-measure, so a large push moves the machine's context figure before the next threshold decision.

## The slot closes with the run

The run's future owns the slot's lifecycle. Drop the task, through abort, timeout, or `select!`, and a close guard seals the slot. A stray handle cannot push into a dead run. `finalize` closes it too, and the two compose.

## Gotchas

1. A push during the model call waits for the boundary. If you need the run to stop, use `cancel()`. Steering is guidance, not interruption.
2. An idle push returns `false` and stores nothing. Check the return value in a UI. A silent retry loop against an idle loop does nothing.
3. Leftovers are sealed, not delivered. Read them with `take_leftovers()` and decide yourself whether they still apply. The next run will not.

## Related pages

- [History rewind](/engine/history-rewind/) is the other host-side seam, for committed history.
- [Contributors](/extensions/contributors/) covers per-turn messages that never persist.
- [Cancellation](/engine/cancellation/) explains the shared-signal pattern steering mirrors.
- [File reference: engine/bare/steering.rs](/file-reference/engine-bare-steering/)
