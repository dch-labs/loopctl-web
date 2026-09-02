# `src/engine/core.rs` — the core module root

Re-export root for the brain-side modules: `pub use lifecycle::*; pub use machine::*;` (outcome's `to_loop_error` is an inherent method on `MachineOutcome`, reached through the machine re-exports).

**Contents**

- [`lifecycle.rs`](engine-lifecycle.md) — the `Loop` trait and the run records.
- [`machine.rs`](engine-machine.md) — the state machine.
- [`outcome.rs`](engine-outcome.md) — outcome→error translation.

Deep dive: [The big idea](../00-start-here/02-the-big-idea.md).
