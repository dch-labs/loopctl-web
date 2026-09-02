---
title: "`src/engine/core.rs` — the core module root"
---


Re-export root for the brain-side modules: `pub use lifecycle::*; pub use machine::*;` (outcome's `to_loop_error` is an inherent method on `MachineOutcome`, reached through the machine re-exports).

**Contents**

- [`lifecycle.rs`](/file-reference/engine-lifecycle/) — the `Loop` trait and the run records.
- [`machine.rs`](/file-reference/engine-machine/) — the state machine.
- [`outcome.rs`](/file-reference/engine-outcome/) — outcome→error translation.

Deep dive: [The big idea](/start-here/the-big-idea/).
