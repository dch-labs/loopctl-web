---
title: "Contributors"
sidebar:
  order: 4
---

A context contributor is the simplest extension point in loopctl. Before each model call, every registered contributor is asked whether it wants to add a message to this turn's request. Its answer rides that request and then vanishes. The source is `src/contributor.rs`.

The classic use is keeping a small model on task by re-sending the original goal every few turns.

## The trait: one method

```rust
pub trait ContextContributor: Send + Sync {
    fn contribute(&self, ctx: &ContributorContext<'_>) -> Option<Message>;
}

pub struct ContributorContext<'a> {
    pub turn: usize,                  // the turn about to run (0-indexed)
    pub conversation: &'a [Message],  // read-only view of what the model will see
}
```

Return `Some(message)` to inject, or `None` to stay quiet this turn.

A `Role::System` message is usually the right choice, because providers route it correctly. loopctl folds system content into each provider's native shape.

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

That exact pattern, re-emitting the first user message every N turns, ships as `presets::GoalReminder::new(n)`.

A `GoalReminder` has been default-wired into every fresh construction since 0.4.0, so your small models get re-anchored unless you opt out with `FrontierProfile`. See [presets](/integration/presets/).

## The lifecycle

Six behaviors are worth internalizing:

- Contributors are consulted at the top of each turn, in registration order, before the request is built.
- Their messages are prepended to that turn's request, extras first, conversation after.
- They are never persisted. Not into history, not into pending, and not into the audit trail.
- Your contributor is asked again next turn, and if it returns nothing its message is absent. There is nothing to clean up, ever.
- If a turn defers to compaction because the fuller payload crossed the threshold, the retried turn consults your contributors again against the compacted history. The reserved budget guarantees the fresh extras still fit.
- Extras count toward the context estimate that the compaction trigger uses, which [the LLM turn](/engine/llm-turn/) covers.

## Contributors vs memory

Both inject per-turn context, and the difference is where the content comes from:

| | Contributor | [Memory](/extensions/memory/) |
|---|---|---|
| Content | Your code computes it | A store retrieved by relevance |
| Stateful across turns? | Whatever your struct holds | Yes, and that is its point |
| Typical jobs | Goal reminders, deadlines, policy restated, today's date | Lessons learned, trajectories, facts |
| Cost per turn | Your computation | A retrieve call |

They compose. A run can have both, and their messages ride the request in a stable order, contributors first and then memory.

Two 0.4.1 siblings extend the idea with different lifetimes. An [attachment](/extensions/attachments/) is pinned context that also rides every request, but you manage it as data and it renders deterministically.

[Steering](/engine/steering/) is the one that lands in committed history, because guidance a user pushes mid-run becomes part of the conversation. A contributor message can never do that, by design.

## Gotchas

- `ctx.conversation` is a snapshot view, so building expensive derived state per call is your budget and not the engine's. Keep `contribute` fast.

- A contributor that always returns a large message adds its size to every request, so mind your context budget on small windows.

- `ContributorContext` is deliberately not `Clone` and it borrows only for the consultation, so you cannot stash it for later.

## Related pages

- [Memory](/extensions/memory/) is the retrieved-context counterpart.
- [Presets](/integration/presets/) covers `GoalReminder` in the Constrained profile.
