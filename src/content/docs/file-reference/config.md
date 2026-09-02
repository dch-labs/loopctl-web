---
title: "`src/config.rs` — `SessionConfig`"
---


Session-scoped settings, stable across runs on one agent.

**Key items**

- `SessionConfig { system_prompt: Option<String>, context_window: u64, compact_threshold: u8, auto_compact: bool }`
- Defaults: `None`, **200,000**, **80**, **true**.
- Builders: `with_system_prompt`, `with_context_window`, `with_compact_threshold` (clamped 0–100), `with_auto_compact`.
- `ParallelMode { Sequential, Parallel }` and `ParallelDispatchConfig { mode, max_concurrency }` — defaults Sequential / 8; clamped to `[1, batch size]` at dispatch.

**Behavior notes**

- Threshold comparison in the machine is **strict** (`>`); the emergency line at 95% is **inclusive** (`>=`) and always on.
- `compact_threshold: 0` disables the threshold trigger; `context_window: 0` disables all window policy.
- Serde deserialization clamps out-of-range thresholds to 100 (won't round-trip the original number); direct struct construction bypasses clamping entirely — prefer builders.
- `max_turns` is *not* here — it's per-run, on `RunConfig`.

Deep dive: [Session config](/core-data/session-config/).
