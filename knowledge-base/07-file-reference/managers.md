# `src/managers.rs` — `LoopManagers`, the component bundle

One struct holding every optional engine component; built by you, consumed by the engine, accessed through the capability traits.

**Key items**

- Always present: `FallbackManager`, `DetectionManager`, `ObserverHost`. Optional (`Option`): context manager, stream handler [streaming], hook executor [hooks], pipeline, health registry [tool_health], memory.
- Builders `with_observer` (appends!), `with_fallback`, `with_detection`, `with_pipeline`, `with_context_manager`, `with_memory`, `with_stream_handler`, `with_hook_executor`, `with_health_registry`.
- Setters: the `set_*` mirrors + `register_observer`.
- `reset_all()` — fallback + detection + observer reset; memory and the rest keep their state; never called automatically.
- `notify_detected_pattern(pattern, turn)` — observer fan-out for detection events (deciding stays with the engine).

**Behavior notes**

- `BareLoop::new_with_managers` **seeds a default ContextManager** (truncating compactor, synced from `SessionConfig`) when the bundle has none; your own is never overridden.
- Not `Clone` — moved into the engine; share the `Arc`-wrapped parts before building.
- The default fallback manager has an **empty chain** — trips without changing the routed model until you configure backups.

Deep dive: [Managers](../04-extensions/05-managers.md).

- 0.4.0 seams on the bundle: `with_ask_resolver` / `with_ask_timeout` (the ask channel) and `with_clock` / `with_id_gen` (the determinism seams — `FixedClock` + `SeededIdGen` make a run's timestamps and ids byte-reproducible). The budget gate installs per-loop (`BareLoop::with_budget_gate`, by value).
