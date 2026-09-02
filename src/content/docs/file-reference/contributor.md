---
title: "`src/contributor.rs` — per-turn message injection"
---


The simplest extension point: one trait, called at the top of every turn, whose answer rides that turn's request and then vanishes.

**Key items**

- `ContextContributor::contribute(&self, ctx: &ContributorContext) -> Option<Message>` — the whole trait.
- `ContributorContext { turn, conversation }` — the turn about to run and a read-only view of what the model will see; deliberately not `Clone`.

**Behavior notes**

- Registered with `agent.add_contributor(...)`; consulted in registration order; messages prepended to the turn's request.
- **Never persisted** — not into history, not into pending, not into the audit trail. Stop returning a message and it's gone next turn.
- A turn deferred to compaction re-consults contributors against the compacted history, with a reserved budget so the fresh messages fit.
- Extras count toward the context estimate (the compaction trigger sees them).

Deep dive: [Contributors](/extensions/contributors/). Shipped implementation: `presets::GoalReminder`.
