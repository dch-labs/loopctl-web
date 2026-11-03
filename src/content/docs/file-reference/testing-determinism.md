---
title: "src/testing/determinism.rs"
---

This file holds the determinism test fixtures: a stepping clock and a capturing observer. Behind the `testing` feature, you use them to assert two engines built from the same seeds produce identical artifacts.

## Key items

`StepClock::new(step)` is a `Clock` whose monotonic half advances one fixed step per read. Every duration your engine measures through the seam is an exact multiple of the step. The wall half is frozen at the Unix epoch, so permission-gate records stamp zero.

`CapturingObserver::new()` records every lifecycle callback into a `Vec<CapturedEvent>`, which you read with `snapshot()`.

`CapturedEvent` is the comparable log: two engines you build from the same seeds assert equal, event for event.

## Behavior notes

Install them like any pinned implementation: `LoopManagers::new().with_clock(Arc::new(StepClock::new(..)))` and `loop.register_observer(Arc::new(CapturingObserver::new()))`.

The captured log is ordered, so a diff you read names the first divergence rather than a set difference.

Added in 0.5.0, promoted from the engine's own test privates.

For the deep dive, see [Testing](/integration/testing/).
