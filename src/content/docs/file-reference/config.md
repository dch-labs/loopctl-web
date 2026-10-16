---
title: "src/config.rs"
---

This file carries your session-scoped settings, the ones that stay stable across runs on one agent. `SessionConfig` is where you declare them.

## Key items

`SessionConfig { system_prompt: Option<String>, context_window: u64, compact_threshold: u8, auto_compact: bool }` is the whole struct.

Defaults are `None`, 200,000, 80, and true.

Your builders are `with_system_prompt`, `with_context_window`, `with_compact_threshold` which clamps 0 to 100, and `with_auto_compact`.

The window you set is the declared window. A client disclosure from `model_context_window()` outranks it at run start since 0.4.0, and `0` is the deliberate opt-out that beats any disclosure.

`ParallelMode { Sequential, Parallel }` and `ParallelDispatchConfig { mode, max_concurrency }` default to Sequential and 8, clamped to [1, batch size] at dispatch.

## Behavior notes

Your threshold comparison in the machine is strict, using `>`, while the emergency line at 95% is inclusive with `>=` and always on.

Set `compact_threshold: 0` to disable the threshold trigger, and `context_window: 0` to disable all window policy.

Serde deserialization clamps out-of-range thresholds to 100, so it won't round-trip the original number, while direct struct construction bypasses clamping entirely. Prefer builders.

`max_turns` is not here. It is per-run, on `RunConfig`.

Deep dive: [Session config](/core-data/session-config/).
