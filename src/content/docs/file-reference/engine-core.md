---
title: "src/engine/core.rs"
---

This file is your re-export root for the brain-side modules: `pub use lifecycle::*; pub use machine::*;`. Read it first when you want to know which import path to write.

You reach outcome's `to_loop_error` as an inherent method on `MachineOutcome`, so the machine re-exports carry it for you and you never name `outcome` in an import.

## Contents

[`lifecycle.rs`](/file-reference/engine-lifecycle/) gives you the `Loop` trait and the run records you read after a run.

[`machine.rs`](/file-reference/engine-machine/) holds the state machine that decides your next step.

[`outcome.rs`](/file-reference/engine-outcome/) owns the translation from an outcome into the error your caller sees.

Deep dive: [The big idea](/start-here/the-big-idea/).
