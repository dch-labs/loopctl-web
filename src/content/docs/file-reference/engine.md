---
title: "src/engine.rs"
---

This file is the re-export root for the whole engine, holding `pub use bare::*; pub use core::*;`.

So when you write `loopctl::engine::{BareLoop, RunConfig, Loop, ...}`, every name resolves from here.

## Key items

`engine::BareLoop` is your driver, and it comes from `bare`.

`engine::core` gives you `Loop`, `Run`, `Session`, `Turn`, `RunConfig`, and `TurnMode`.

It also gives you `LoopMachine`, `MachineState`, `MachineStep`, `MachineOutcome`, and `MachinePolicy`, all from `core`.

## Behavior notes

Two namespaces sit behind one door. `engine::core` holds the brain-side types, and `engine::bare` holds the driver.

Most user code imports from `engine` directly, so the split never notices a change to your imports.

For the deep dives, see [the state machine](/engine/state-machine/) and [the driver](/engine/driver-loop/). For the sibling root, see [engine-core](/file-reference/engine-core/).
