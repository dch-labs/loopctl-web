---
title: "Termination"
sidebar:
  order: 7
---

A run ends in exactly one of five shapes, with a few new error faces inside them.

This page is your complete map: what triggers each ending, the code path it takes, and what state is left behind for you.

## The five endings

| Ending | Triggered by | You receive |
|---|---|---|
| **Completed** | A model reply with no tool calls | `Ok(Run)` with `output` set |
| **MaxTurnsExceeded** | `turns_taken >= RunConfig::max_turns` (default 200) | `Err(LoopError::MaxTurnsExceeded { max })` |
| **Cancelled** | The cancel signal fired | `Err(LoopError::Cancelled)` — clean stop, not a failure |
| **ContextExceeded** | Compaction couldn't shrink enough | `Err(LoopError::ContextExceeded { used, limit })` |
| **Failed** | Any other error: provider dead, loop detected, recovery exhausted... | `Err(the matching LoopError)` |

Note the retention asymmetry, new in 0.4.0. **`Completed` commits the whole scratchpad.** **`Cancelled` and ordinary failures salvage the coherent prefix**, so completed turns commit and the in-flight exchange drops. That means an interrupt costs you one turn, not the run's conversation.

**The `ContextExceeded` family discards the scratchpad whole**, because an unshrinkable over-window history must not wedge every future run you start.

One further exception cuts across all of this. A run that compacted mid-run and then failed keeps the compacted history, because compaction is a commit point. [The big idea](/start-here/the-big-idea/) covers why.

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

The check is first in the decision order. So a run at your turn limit never starts one more model call, not even a compaction pass.

### Cancelled

```text
cancel fires → some biased select! returns Err(Cancelled)
  → driver: because it is Cancelled → machine.cancel() (NOT machine.fail())
  → next_step drives Terminal(Cancelled)
  → finalize(Some(err)) → salvage_pending → signal re-armed
  → Err(Cancelled)
```

The full story is in [cancellation](/engine/cancellation/). The distinction between Cancelled and Failed is deliberate, because your code can treat a user stop as control flow through `err.is_cancelled()`.

### ContextExceeded

You have several entrances here and one family, plus, since 0.4.0, one rescue in front of them all:

```text
0) overflow salvage (first rejection only):
   provider rejects with an oversized-prompt error
   → the failed turn fires its turn-end, the machine is forced onto the
     emergency compaction path with a target strictly under the refused
     payload (CompactSizing::target_override)
   → the same turn is re-requested against the compacted history
   → a repeat rejection on the spent turn is a genuine misfit: ContextExceeded

A) compactor overflow:
   ContextManager.compact_with_reason → Err(ContextOverflow)
   → handle_compact propagates → set_error_state → machine.fail(...)
   → finalize(Some(err)) → Err(CompactionFailed / ContextExceeded)

B) no-progress guard:
   compaction_result / compaction_noop sees tokens_after >= tokens_before
   → machine goes Terminal(Failed(CompactionStalled)) directly
   → Done arm → finalize(Some(err))
   (carve-out: a threshold-triggered stall whose payload still fits the
    window defers and serves instead — only emergency-line stalls die)
```

In all of these, your buffers are left as they were. The full stories are [compaction](/engine/compaction/) and [context accounting](/engine/context-accounting/).

Whatever still kills your run, the run-end carries `unfinished_input`, so your host can offer one-click resubmission.

### Failed (everything else)

```text
a handler returns Err (provider, dispatch, loop detected, recovery exhausted,
                      budget exhausted — the hard line refuses BEFORE the request)
  → set_error_state: machine.fail(error)   [immediate Terminal(Failed)]
  → finalize(Some(err)) → salvage_pending → on_run_end(success=false)
  → Err(error)
```

The `Done` arm defends itself against future unknown outcomes too. A terminal outcome that maps to no error becomes `LoopError::Internal("unmapped terminal outcome")` rather than silently committing as success on you.

## What each ending leaves behind

| After the run | `machine.history` | `machine.pending` | `session.runs` | cancel signal |
|---|---|---|---|---|
| Completed | + this run's messages | empty | run recorded, `stop_reason: None` | re-armed |
| Cancelled / ordinary failure | + the run's completed turns (salvaged) | in-flight tail dropped | run recorded, `stop_reason: Some(err)` | re-armed |
| `ContextExceeded` family | unchanged | cleared whole | run recorded, `stop_reason: Some(err)` | re-armed |

Your run record always survives. Every ending writes its `Run`, with `stop_reason`, into the audit trail.

And `on_run_end` always fires, so your observers see `success: false` and the error text on failures.

### What observers see, per ending

| Ending | `on_run_end` payload | Other events on the way out |
|---|---|---|
| Completed | `success: true` | `on_response` for the final reply; a `memory.consolidate()` if memory is installed |
| MaxTurnsExceeded | `success: false` + the error | usually none — the check fires *before* the next model call, so the run simply stops |
| Cancelled | `success: false` + `Cancelled` | whatever the interrupted phase already emitted (deltas, `on_tool_pre` without its `on_tool_post`, ...) |
| ContextExceeded | `success: false` + the error | `on_compaction` if a real pass ran before the failure |
| Failed | `success: false` + the error | failure-specific: `on_stream_failure`, `on_loop_detected`, `on_fallback`... |

The Cancelled row's "without its post" case is worth flagging for anyone pairing events. A cancellation mid-tool leaves an `on_tool_pre` orphaned by design, because the tool was dropped and there is no result to report.

Pair by id, and treat an orphaned pre as cancelled rather than lost.

### Outcome → error → `stop_reason`, the complete mapping

| `MachineOutcome` | `to_loop_error()` | `Run::stop_reason` |
|---|---|---|
| `Completed { final_text }` | `None` | `None` — the only ending with no error at all |
| `MaxTurnsExceeded` | `MaxTurnsExceeded { max }` | that error |
| `Cancelled` | `Cancelled` | `Cancelled` |
| `Failed { error }` | the error it was born with | that error |

That mapping is total and mechanical, and the `Done` arm defends the corner case. A terminal outcome that maps to no error becomes `LoopError::Internal("unmapped terminal outcome")` rather than silently committing as success.

## After a failed run: what now?

Your agent is **immediately reusable**. Your history is clean, the signal is fresh, and your next `run()` starts from the last good state.

Fix the cause first, or you will hit the same wall:

| You saw | Typical fixes |
|---|---|
| `MaxTurnsExceeded` | raise `max_turns`; simplify the task; the goal reminder is default-wired since 0.4.0 |
| `ContextExceeded` / `CompactionStalled` | bigger window; the `FallbackCompactor` chain; prune (`set_prune`) to reclaim tool outputs; trim huge tool outputs (`OutputLimitMiddleware`) |
| `BudgetExhausted` | raise the [budget gate](/safety/budget-gate/)'s limits or let the run end — the point of a budget |
| `LoopDetected` | fix the tool the model is stuck on; tune detection thresholds; check `ToolSignature` extraction |
| `Api` / `RateLimitEscalation` | configure [fallback models](/safety/fallback/) and a rate limiter |
| `ToolRecoveryExhausted` | install a smarter [reflector](/safety/reflection/) or fix the tool |
| `FallbackExhausted` | wait out the cooldown (default 60s — the next turn probes the primary) or add chain depth |

One more subtle guarantee is worth knowing about your runs. At the end of **every** run, the engine clears a pending loop-detection stop that the run never fired.

That happens, for example, when the model crossed the stop threshold on its last call but then went terminal on its own.

Without this, your next run's first dispatch would be killed by repetitions it never produced. Cross-run detection state is deliberately clean.

Convergence state, by contrast, deliberately persists, because cross-run answer streaks are meaningful for the opt-in `Stop` and `AskUser` actions you can wire up.

## Related pages

- [Errors](/core-data/errors/): the full `LoopError` table.
- [The state machine](/engine/state-machine/): where terminal states come from.
