---
title: "src/observer.rs"
---

This file gives you read-only spectators of engine events: one required method, `name`, and every event optional.

## Key items

Your `LoopObserver` carries 24 callbacks, all defaulting to no-op. They cover run start and end, turn start and end, response, text and thinking deltas, and attempt reset.

They also cover tool call received, pre and post, gate decision, stream success and failure, transport fallback, and the compaction family.

Your last group covers fallback, model switched, budget warn, loop detected, convergence detected, and `reset`.

The additions since 0.3.2 are attempt reset, gate decision, transport fallback, pre-compaction, compaction failed, and budget warn.

`ObserverHost` gives you `register`, which appends, so a duplicate registration earns you duplicate events.

Its fan-out follows registration order with panic isolation, so a panicking observer is logged and skipped.

You also get `reset_all` plus `len` and `is_empty`.

## Behavior notes

Your observers cannot influence control flow. Reach for hooks when you need that power.

The host's dispatch is `catch_unwind`-wrapped, so one bad observer never takes your run down, and never silences the others.

Delta callbacks run on the stream-ingestion path, so keep them light. Buffer here and render elsewhere.

Deep dive: [Observers](/extensions/observers/). Event payloads: [context.rs](/file-reference/observer-context/).
