---
title: "`src/engine/bare/dispatch.rs` — tool dispatch"
---


The per-call pipeline, both dispatch modes, and the recovery loop. (~1,950 lines with tests.)

**Key items**

- `dispatch_tools` — sequential (cancel checked between calls) or parallel (`ToolDependencyGraph` waves: `is_safe_for_concurrent_execution` + `resource_key` conflicts; semaphore-clamped; results in input order; hard error discards resolved siblings).
- `execute_tool_call` — the full per-attempt pipeline: pre observer → hooks → pre-detection (pure read; stop → hard error) → breaker gate → biased cancel-vs-dispatch → post-detection (the single write point) → post observer → post hooks → health → memory → recovery.
- `dispatch_tool` — pipeline first if configured, else registry; panic-isolated (`catch_unwind`); unknown tool → soft error listing available names.
- `recovery_wait_or_return` — reflect + decide; cancel-aware backoff; the `attempt > 5` ceiling → `ToolRecoveryExhausted`.
- `apply_correction_if_present` — input swap / tool swap; failed corrections logged and dropped.
- `record_tool_memory` — trajectory entries (500-char truncation) after successful calls only.

**Behavior notes**

- Side effects (observers, hooks, detection, health) fire per **attempt** in both modes.
- The engine stamps `tool_call_id` after the pipeline returns — middleware ids are advisory.
- The breaker gate keys on the requested name; `health_key` records under the resolved name.

Deep dive: [Tool dispatch](/engine/tool-dispatch/).
