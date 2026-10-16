---
title: "src/managers.rs"
---

This file is `LoopManagers`, one struct holding every optional engine component. You build it, your engine consumes it, and you reach it through the capability traits instead of a field grab.

## Key items

Always present are `FallbackManager`, `DetectionManager`, and `ObserverHost`. Optional slots hold your context manager, stream handler under `streaming`, hook executor under `hooks`, pipeline, health registry under `tool_health`, and memory.

Your builders are `with_observer`, which appends, `with_fallback`, `with_detection`, `with_pipeline`, `with_context_manager`, `with_memory`, `with_stream_handler`, `with_hook_executor`, and `with_health_registry`.

Your setters mirror those as `set_*` and add `register_observer`.

`reset_all()` resets fallback, detection, and observers, while memory and the rest keep their state. Nothing calls it automatically.

`notify_detected_pattern(pattern, turn)` is your fan-out for detection events, and deciding stays with the engine.

## Behavior notes

`BareLoop::new_with_managers` seeds a default ContextManager, with a truncating compactor synced from `SessionConfig`, when your bundle has none. Your own is never overridden.

The bundle is not `Clone`, since it is moved into the engine. Share the `Arc`-wrapped parts before building.

Your default fallback manager has an empty chain, so it trips without changing the routed model until you configure backups.

The 0.4.0 seams on the bundle are `with_ask_resolver` and `with_ask_timeout` for the ask channel.

Determinism rides `with_clock` and `with_id_gen`, where `FixedClock` and `SeededIdGen` make a run's timestamps and ids byte-reproducible.

The budget gate installs per-loop through `BareLoop::with_budget_gate`, by value.

Deep dive: [Managers](/extensions/managers/).
