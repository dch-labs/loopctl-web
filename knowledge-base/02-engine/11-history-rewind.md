# History rewind

Your user edits a prompt that already went out. The turn it spawned is wrong, and the conversation should read as though it never ran.

**Rewind** is the host-side seam for that. You cut committed history back to a length you observed, on the same machine, with the same client, observers, and cancel signal. Nothing is rebuilt. Added in 0.4.1. Sources: `src/engine/core/machine.rs`, `src/engine/bare.rs`.

## The call

Capture the history length before the turn you may want to replace. The seam has no memory of what you observed, so you own the number.

```rust
// Before the turn: note the length.
let before = agent.machine().history().len();

// The turn runs, then the user replaces their prompt.
let removed = agent.rewind_history_to(before)?;
```

`LoopMachine::rewind_to(len)` is the machine-level original. `BareLoop::rewind_history_to(len)` is the loop-level wrapper you normally call. Both return how many messages were removed.

## The cut is length-shaped and boundary-safe

You pass a history length, not message ids, and no message identity is exposed. The cut snaps to a turn boundary. A `len` landing between a tool call and its result snaps down to that turn's start, so no `ToolCall` is ever orphaned from its `ToolResult`.

| Input | Result |
|---|---|
| a boundary `len` | history truncated to exactly `len` |
| a mid-turn `len` | snaps down to the turn's start |
| `len` at or beyond current length | `Ok(0)`, nothing removed |
| a turn in flight | `Err(InvalidInput)` naming the state |

A turn in flight refuses. Cancel the run, let it resolve, then rewind. Cancel-then-resolve-then-rewind is the supported path.

## Bookkeeping settles on record

A rewind that removes anything also invalidates the usage anchor and any prepared turn, exactly as a prune adoption does. The deferred-compaction latch clears, so a stale latch from the dropped tail cannot suppress a trigger against the shorter history.

The compaction threshold re-arms naturally on the next run. A rewind below the last compaction floor is simply a shorter history.

What the machine does not touch survives untouched:

| Lives on | Survives a rewind to zero? |
|---|---|
| the system prompt, held on the session config outside the machine | yes, on the wire |
| run records, which are not derived from machine history | yes, as recorded |
| `turns_taken` and `context_tokens`, per-run figures | reset by the next `accept_input` |

## The wire evidence

The next provider request carries the pruned history, byte-shaped. A three-turn conversation rewound past its middle turn sends `[user first, assistant first, user third]`, with the superseded pair gone. A rewound-to-zero loop runs again, and the machine accepts new input.

## Gotchas

1. Rewind refuses a turn in flight. The error names the machine state. Cancel first, await the run's resolution, then call again.
2. You own the length. Capture `history().len()` before the turn you may want to replace, because the seam cannot recover it for you.
3. Run records stay. The audit trail in `session.runs` is observational. Rewind changes the conversation, not the record of what ran.

## Related pages

- [Steering](10-steering.md) covers guidance into the next boundary, the other half of host control.
- [The state machine](01-state-machine.md) explains the buffers a rewind cuts.
- [Compaction](06-compaction.md) is the other thing that shortens history, by engine decision.
- [File reference: engine/core/machine.rs](../07-file-reference/engine-machine.md)
