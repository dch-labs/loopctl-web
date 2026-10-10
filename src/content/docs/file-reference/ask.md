---
title: "`src/ask.rs` — the external-approver ask channel"
---


The park-and-resume machinery for hook `Ask` decisions: a run without a human in the loop can still *wait* for one. No feature flag; the types compile everywhere, the engine consumption rides `hooks`.

**Key items**

- `PendingAsk` — the serialized question: id, session/run/turn/call binding, the call's `args_digest` (never the arguments), the hook's prompt.
- `AskResolver` — the trait the engine awaits; `SyncAskResolver::new(closure)` adapts the old answer-on-sight shape.
- `ApprovalChannel::pair(capacity)` — the reference implementation: one half parks with the engine, the `Approver` half answers by id from anywhere. `Approver::resolve(id, resolution) -> bool` (a late/duplicate answer is inert).
- Installed via `LoopManagers::with_ask_resolver(...)` / `with_ask_timeout(duration)`.

**Behavior notes**

- Single-use bindings by construction: the channel drops its completion slot when the wait ends.
- Fail-closed everywhere: a dropped approver denies every still-awaiting ask (`Approver`'s `Drop` drains); an expired deadline denies (`AskExpired`, engine-sourced); a cancel during the park ends the run typed `Cancelled`.
- Exactly one gate record per ending, whichever gate minted it — approvals ride the dispatch result and are emitted after dispatch returns (or earlier when the call stops before dispatching).

Deep dive: [Approvals](/safety/approvals/)
