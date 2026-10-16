---
title: "src/contributor.rs"
---

This file is your simplest extension point: one trait for per-turn message injection, called at the top of every turn, whose answer rides that request and then vanishes. Reach for it when you want the model to see something without remembering that you showed it.

## Key items

`ContextContributor::contribute(&self, ctx: &ContributorContext) -> Option<Message>` is the whole trait you implement.

`ContributorContext { turn, conversation }` hands you the turn about to run and a read-only view of what your model will see, deliberately without `Clone`.

## Behavior notes

You register with `agent.add_contributor(...)`, and your engine consults contributors in registration order, prepending their messages to your turn's request.

Nothing you contribute is ever persisted: not into history, not into pending, not into the audit trail. Stop returning a message and it is gone next turn.

A turn deferred to compaction re-consults your contributors against the compacted history, with a reserved budget so the fresh messages fit.

Your extras count toward the context estimate, so your compaction trigger sees them too.

Deep dive: [Contributors](/extensions/contributors/). Shipped implementation: `presets::GoalReminder`.
