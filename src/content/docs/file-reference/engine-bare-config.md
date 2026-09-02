---
title: "`src/engine/bare/config.rs` — the builder surface"
---


Every `set_*` / `with_*` method on `BareLoop`, the temp-dir management, and the `TextStreamer` type.

**Key items**

- Setters (all `debug_assert_idle` — before first run): `set_reflector`, `set_recovery_strategy`, `set_context_manager` (re-syncs window/threshold from session config), `set_token_counter` (driver fallback only — the manager's counter rules), `set_stream_handler` [streaming], `set_hook_executor` [hooks], `set_health_registry` [tool_health], `set_memory`, `set_pipeline` (injects the loop's registry as core), `register_observer`, `set_text_streamer`, `add_contributor`, `set_request_options`, `set_turn_mode` — each with a fluent `with_*` twin.
- `with_temp_dir(base)` / `with_managed_temp_disabled()` — managed temp control.
- `TextStreamer = Arc<dyn Fn(&str) + Send + Sync>` — the simple per-chunk text callback.
- `debug_assert_idle()` — debug panics if the machine advanced past `Start`.

**Behavior notes**

- `set_pipeline` never takes a builder with a core — it injects the loop's own registry; building manually elsewhere needs `with_core`.
- The two token counters (driver fallback vs manager) are deliberately not synced — configure the manager's and the driver follows it.
- `set_context_manager` syncs window/threshold from the session config — the session config owns window policy.

Deep dive: [The driver](/engine/driver-loop/).
