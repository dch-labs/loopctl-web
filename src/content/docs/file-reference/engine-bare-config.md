---
title: "src/engine/bare/config.rs"
---

This file is your builder surface: every `set_*` and `with_*` method on `BareLoop`, the temp-dir management, and the `TextStreamer` type.

## Key items

Your setters all call `debug_assert_idle`, so run them before the first run. They cover `set_reflector`, `set_recovery_strategy`, and `set_context_manager`, which re-syncs window and threshold from session config.

They also cover `set_token_counter`, which is the driver fallback only since the manager's counter rules, plus `set_stream_handler` under `streaming`, `set_hook_executor` under `hooks`, and `set_health_registry` under `tool_health`.

The rest are `set_memory`, `set_pipeline` which injects your loop's registry as core, `register_observer`, `set_text_streamer`, `add_contributor`, `set_request_options`, and `set_turn_mode`.

Each setter has a fluent `with_*` twin you can chain instead.

`with_temp_dir(base)` and `with_managed_temp_disabled()` give you managed temp control, and `TextStreamer = Arc<dyn Fn(&str) + Send + Sync>` is your simple per-chunk text callback.

`debug_assert_idle()` panics in debug builds if the machine already advanced past `Start`.

## Behavior notes

`set_pipeline` never takes a builder with a core, because it injects your loop's own registry. Building a pipeline manually elsewhere needs `with_core`.

Your two token counters, driver fallback and manager, are deliberately not synced. Configure the manager's and the driver follows it.

`set_context_manager` syncs window and threshold from your session config, because session config owns window policy.

Deep dive: [The driver](/engine/driver-loop/).
