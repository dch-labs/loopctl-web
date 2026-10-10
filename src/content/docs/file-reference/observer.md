---
title: "`src/observer.rs` — the `LoopObserver` trait"
---


Read-only spectators of engine events: one required method (`name`), every event optional.

**Key items**

- `LoopObserver` — 24 callbacks, all defaulting to no-op: run start/end, turn start/end, response, text/thinking deltas, attempt reset, tool call received/pre/post, gate decision, stream success/failure, transport fallback, pre-compaction, compaction, compaction failed, fallback, model switched, budget warn, loop/convergence detected, `reset` — the additions since 0.3.2 are attempt reset, gate decision, transport fallback, pre-compaction, compaction failed, and budget warn.
- `ObserverHost` — `register` (append; duplicate registration = duplicate events), fan-out in registration order, **panic isolation** (a panicking observer is logged and skipped), `reset_all`, `len`/`is_empty`.

**Behavior notes**

- Observers cannot influence control flow — for that, hooks.
- The host's dispatch is `catch_unwind`-wrapped: one bad observer never takes the run down (and never silences the others).
- Delta callbacks run on the stream-ingestion path — keep them light; buffer and render elsewhere.

Deep dive: [Observers](/extensions/observers/). Event payloads: [context.rs](/file-reference/observer-context/).
