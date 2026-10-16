---
title: "src/engine/core/outcome.rs"
---

This small file carries one load-bearing job: the canonical mapping from a terminal `MachineOutcome` to the `LoopError` your caller sees. Read it when you want to know exactly what a finished run hands back.

## Key items

`MachineOutcome::to_loop_error(max_turns) -> Option<LoopError>` is the whole mapping. `Completed { .. }` becomes `None`, because a clean completion is not an error.

`MaxTurnsExceeded` becomes `MaxTurnsExceeded { max }`, and `Cancelled` becomes `Cancelled`.

A `Failed { error }` outcome yields the error itself, unchanged.

## Behavior notes

Treat this as your single source of truth: both your driver's `Done` arm and `Loop::stop_reason()` go through it, so the two can never disagree.

The `Done` arm additionally guards the future. A non-`Completed` outcome that maps to no error becomes `LoopError::Internal("unmapped terminal outcome: ...")` rather than committing as success.

So adding a `MachineOutcome` variant without mapping it is a loud bug for you, not a silent one.

Deep dive: [Termination](/engine/termination/).
