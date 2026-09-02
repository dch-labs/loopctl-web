---
title: "Contributors — a message before every turn"
sidebar:
  order: 4
---


A **context contributor** is the simplest extension point in loopctl: before each model call, every registered contributor gets asked *"want to add a message to this turn's request?"* — and its answer rides that request, then vanishes. Source: `src/contributor.rs`.

The classic use: keep a small model on task by re-sending the original goal every few turns.

---

## The trait — one method

```rust
pub trait ContextContributor: Send + Sync {
    fn contribute(&self, ctx: &ContributorContext<'_>) -> Option<Message>;
}

pub struct ContributorContext<'a> {
    pub turn: usize,                  // the turn about to run (0-indexed)
    pub conversation: &'a [Message],  // read-only view of what the model will see
}
```

Return `Some(message)` to inject, `None` to stay quiet this turn. A `Role::System` message is usually right — providers route it correctly (loopctl folds system content into each provider's native shape).

```rust
struct GoalReminder {
    every_n: usize,
}

impl ContextContributor for GoalReminder {
    fn contribute(&self, ctx: &ContributorContext<'_>) -> Option<Message> {
        let goal = ctx.conversation.first()?.text_content();
        if goal.is_empty() { return None; }
        Some(Message::new(Role::System,
            vec![MessagePart::text(format!("Reminder — the task is: {goal}"))]))
    }
}

agent.add_contributor(Box::new(GoalReminder { every_n: 5 }));
```

(That exact pattern — re-emit the first user message every N turns — ships as `presets::GoalReminder::new(5)`.)

## The lifecycle — the part to internalize

- Contributors are consulted at the **top of each turn**, in registration order, *before* the request is built.
- Their messages are **prepended** to that turn's request — extras first, conversation after.
- They are **never persisted**. Not into history, not into pending, not into the audit trail. Next turn the contributor is asked again; if it returns nothing, its message is simply absent. There is nothing to clean up, ever.
- If a turn defers to compaction (the fuller payload crossed the threshold), the retried turn consults contributors **again** against the compacted history — and the reserved budget guarantees the fresh extras still fit.
- Extras count toward the context estimate the compaction trigger uses (see [the LLM turn](/engine/llm-turn/)).

## Contributors vs memory — when to use which

Both inject per-turn context. The difference is *where the content comes from*:

| | Contributor | [Memory](/extensions/memory/) |
|---|---|---|
| Content | your code computes it | a store retrieved by relevance |
| Stateful across turns? | whatever your struct holds | yes, that's its point |
| Typical jobs | goal reminders, deadlines, policy restated, "today's date" | lessons learned, trajectories, facts |
| Cost per turn | your computation | a retrieve call |

They compose — a run can have both, and their messages ride the request in a stable order (contributors, then memory).

## Gotchas

- `ctx.conversation` is a *snapshot view* — building expensive derived state per call is your budget, not the engine's. Keep `contribute` fast.
- A contributor that always returns `Some(big_message)` adds its size to **every** request — mind the context budget on small windows.
- `ContributorContext` is deliberately not `Clone` and borrows only for the consultation — you can't stash it for later.

---

## Related pages

- [Memory](/extensions/memory/) — the retrieved-context counterpart.
- [Presets](/integration/presets/) — `GoalReminder` in the Constrained profile.
