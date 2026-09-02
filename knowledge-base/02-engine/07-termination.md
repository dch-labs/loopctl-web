# Termination — every way a run can end

A run ends in exactly one of five ways. This page is the complete map: what triggers each ending, the code path it takes, and what state is left behind.

---

## The five endings

| Ending | Triggered by | You receive |
|---|---|---|
| **Completed** | A model reply with no tool calls | `Ok(Run)` with `output` set |
| **MaxTurnsExceeded** | `turns_taken >= RunConfig::max_turns` (default 200) | `Err(LoopError::MaxTurnsExceeded { max })` |
| **Cancelled** | The cancel signal fired | `Err(LoopError::Cancelled)` — clean stop, not a failure |
| **ContextExceeded** | Compaction couldn't shrink enough | `Err(LoopError::ContextExceeded { used, limit })` |
| **Failed** | Any other error: provider dead, loop detected, recovery exhausted... | `Err(the matching LoopError)` |

Note the asymmetry: **`Completed` is the only ending that commits.** Its scratchpad glues into history. Every other ending discards the scratchpad — one exception: a run that compacted mid-run and *then* failed (compaction is a commit point; see [the big idea](../00-start-here/02-the-big-idea.md)).

---

## The code paths, one by one

### Completed

```text
model reply (no tool calls)
  → machine.model_response() sets Terminal(Completed { final_text })
  → next next_step() returns Done(Completed)
  → run() breaks the loop
  → finalize(None): commit_pending + memory.consolidate + on_run_end
  → Ok(Run { output: Some(final_text), ... })
```

### MaxTurnsExceeded

```text
next_step(): turns_taken >= policy.max_turns
  → machine sets Terminal(MaxTurnsExceeded) — checked BEFORE compaction and model call
  → Done arm → finalize(Some(err)) → discard_pending
  → Err(MaxTurnsExceeded { max })
```

The check is first in the decision order, so a run at its turn limit never starts one more model call — not even a compaction pass.

### Cancelled

```text
cancel fires → some biased select! returns Err(Cancelled)
  → driver: because it is Cancelled → machine.cancel() (NOT machine.fail())
  → next_step drives Terminal(Cancelled)
  → finalize(Some(err)) → discard_pending → signal re-armed
  → Err(Cancelled)
```

Full story: [cancellation](05-cancellation.md). The distinction Cancelled-vs-Failed is deliberate — your code can treat a user stop as control flow (`err.is_cancelled()`).

### ContextExceeded

Two entrances, one error:

```text
A) compactor overflow:
   ContextManager.compact_with_reason → Err(ContextOverflow)
   → handle_compact propagates → set_error_state → machine.fail(...)
   → finalize(Some(err)) → Err(ContextExceeded { used, limit })

B) no-progress guard:
   compaction_result / compaction_noop sees tokens_after >= tokens_before
   → machine goes Terminal(Failed(ContextExceeded)) directly
   → Done arm → finalize(Some(err))
```

In both, the buffers are left as they were. Full story: [compaction](06-compaction.md).

### Failed (everything else)

```text
a handler returns Err (provider, dispatch, loop detected, recovery exhausted)
  → set_error_state: machine.fail(error)   [immediate Terminal(Failed)]
  → finalize(Some(err)) → discard_pending → on_run_end(success=false)
  → Err(error)
```

The `Done` arm defends itself against future unknown outcomes too: a terminal outcome that maps to no error becomes `LoopError::Internal("unmapped terminal outcome")` rather than silently committing as success.

---

## What each ending leaves behind

| After the run | `machine.history` | `machine.pending` | `session.runs` | cancel signal |
|---|---|---|---|---|
| Completed | + this run's messages | empty | run recorded, `stop_reason: None` | re-armed |
| Any other | unchanged | cleared | run recorded, `stop_reason: Some(err)` | re-armed |

The run record always survives — every ending writes its `Run` (with `stop_reason`) into the audit trail, and `on_run_end` always fires (observers see `success: false` and the error text on failures).

### What observers see, per ending

| Ending | `on_run_end` payload | Other events on the way out |
|---|---|---|
| Completed | `success: true` | `on_response` for the final reply; a `memory.consolidate()` if memory is installed |
| MaxTurnsExceeded | `success: false` + the error | usually none — the check fires *before* the next model call, so the run simply stops |
| Cancelled | `success: false` + `Cancelled` | whatever the interrupted phase already emitted (deltas, `on_tool_pre` without its `on_tool_post`, ...) |
| ContextExceeded | `success: false` + the error | `on_compaction` if a real pass ran before the failure |
| Failed | `success: false` + the error | failure-specific: `on_stream_failure`, `on_loop_detected`, `on_fallback`... |

The Cancelled row's "without its post" case is worth flagging for anyone pairing events: a cancellation mid-tool leaves an `on_tool_pre` orphaned by design — the tool was dropped, there is no result to report. Pair by id, and treat an orphaned pre as "cancelled," not "lost."

### Outcome → error → `stop_reason`, the complete mapping

| `MachineOutcome` | `to_loop_error()` | `Run::stop_reason` |
|---|---|---|
| `Completed { final_text }` | `None` | `None` — the only ending with no error at all |
| `MaxTurnsExceeded` | `MaxTurnsExceeded { max }` | that error |
| `Cancelled` | `Cancelled` | `Cancelled` |
| `Failed { error }` | the error it was born with | that error |

Total and mechanical — and the `Done` arm defends the corner case: a terminal outcome that maps to *no* error becomes `LoopError::Internal("unmapped terminal outcome")` rather than silently committing as success.

---

## After a failed run — what now?

The agent is **immediately reusable**: history is clean, the signal is fresh, the next `run()` starts from the last good state. But fix the cause first, or you'll hit the same wall:

| You saw | Typical fixes |
|---|---|
| `MaxTurnsExceeded` | raise `max_turns`; simplify the task; add a goal-reminder contributor for small models |
| `ContextExceeded` | bigger window; summarizing compactor; trim huge tool outputs (`OutputLimitMiddleware`) |
| `LoopDetected` | fix the tool the model is stuck on; tune detection thresholds; check `ToolSignature` extraction |
| `Api` / `RateLimitEscalation` | configure [fallback models](../03-safety/04-fallback.md) and a rate limiter |
| `ToolRecoveryExhausted` | install a smarter [reflector](../03-safety/05-reflection.md) or fix the tool |
| `FallbackExhausted` | wait out the cooldown (default 60s — the next turn probes the primary) or add chain depth |

One more subtle guarantee worth knowing: at the end of **every** run, the engine clears a pending loop-detection stop that the run never fired (e.g. the model crossed the stop threshold on its last call but then went terminal on its own). Without this, the *next* run's first dispatch would be killed by repetitions it never produced. Cross-run detection state is deliberately clean; convergence state deliberately persists (cross-run answer streaks are meaningful for the opt-in `Stop`/`AskUser` actions).

---

## Related pages

- [Errors](../01-core-data/05-errors.md) — the full `LoopError` table.
- [The state machine](01-state-machine.md) — where terminal states come from.
