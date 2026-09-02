---
title: "`src/engine/core/outcome.rs` — outcome → error"
---


One small file with one load-bearing job: the canonical mapping from a terminal `MachineOutcome` to the `LoopError` a caller sees.

**Key items**

- `MachineOutcome::to_loop_error(max_turns) -> Option<LoopError>`:
  - `Completed { .. }` → `None` (a clean completion is not an error)
  - `MaxTurnsExceeded` → `MaxTurnsExceeded { max }`
  - `Cancelled` → `Cancelled`
  - `Failed { error }` → the error itself

**Behavior notes**

- Single source of truth: both the driver's `Done` arm and `Loop::stop_reason()` go through it — the two can never disagree.
- The `Done` arm additionally guards the future: a non-`Completed` outcome that maps to no error becomes `LoopError::Internal("unmapped terminal outcome: ...")` rather than committing as success — adding a `MachineOutcome` variant without mapping it is a loud bug, not a silent one.

Deep dive: [Termination](/engine/termination/).
