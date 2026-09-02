# `src/engine.rs` — the engine module root

The re-export root for the whole engine: `pub use bare::*; pub use core::*;` — so `loopctl::engine::{BareLoop, RunConfig, Loop, ...}` all resolve from here.

**Key items**

- `engine::BareLoop` — the driver (from `bare`).
- `engine::core::{Loop, Run, Session, Turn, RunConfig, TurnMode, LoopMachine, MachineState, MachineStep, MachineOutcome, MachinePolicy}` (from `core`).

**Behavior notes**

- Two namespaces behind one door: `engine::core` holds the brain-side types, `engine::bare` the driver — most user code imports from `engine` directly and never notices.

Deep dives: [state machine](../02-engine/01-state-machine.md) · [driver](../02-engine/02-driver-loop.md). Sibling root: [engine-core.md](engine-core.md).
