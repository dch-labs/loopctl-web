---
title: "src/ask.rs"
---

This file is your park-and-resume machinery for hook `Ask` decisions, so a run without a human in the loop can still wait for one. There is no feature flag: the types compile everywhere, and engine consumption rides `hooks`.

## Key items

`PendingAsk` is the serialized question: id, session, run, turn, and call binding, the call's `args_digest` (never the arguments), and the hook's prompt.

`AskResolver` is the trait your engine awaits. `SyncAskResolver::new(closure)` adapts the old answer-on-sight shape for you.

`ApprovalChannel::pair(capacity)` is the reference implementation: one half parks with the engine, and the `Approver` half answers by id from anywhere.

`Approver::resolve(id, resolution) -> bool` tells you whether it counted, and a late or duplicate answer is inert.

You install all of it through `LoopManagers::with_ask_resolver(...)` and `with_ask_timeout(duration)`.

## Behavior notes

Your bindings are single-use by construction: the channel drops its completion slot when the wait ends.

Behavior is fail-closed everywhere. A dropped approver denies every still-awaiting ask, since `Approver`'s `Drop` drains, and an expired deadline denies with the engine-sourced `AskExpired`.

A cancel during the park ends your run typed `Cancelled`.

You get exactly one gate record per ending, whichever gate minted it. Approvals ride the dispatch result and are emitted after dispatch returns, or earlier when the call stops before dispatching.

Deep dive: [Approvals](/safety/approvals/)
