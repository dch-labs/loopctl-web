---
title: "src/engine/bare/dispatch.rs"
---

This file runs your per-call pipeline, both dispatch modes, and the recovery loop. It runs about 1,950 lines with tests.

## Key items

`dispatch_tools` is sequential, checking cancel between calls, or parallel.

Parallel mode plans `ToolDependencyGraph` waves from `is_safe_for_concurrent_execution` plus `resource_key` conflicts, clamps them with a semaphore, returns results in input order, and discards resolved siblings on a hard error.

`execute_tool_call` is your full per-attempt pipeline. It starts with the pre observer, then hooks, where an `Ask` with a resolver parks the run through the ask channel (0.4.0).

Next comes pre-detection, a pure read where a stop becomes a hard error, then the breaker gate, then the biased cancel-vs-dispatch.

Then post-detection, which is the single write point, then the post observer, then gate-decision emission through `on_gate_decision`, ordered pre, gate, post (0.4.0).

The tail is post hooks, health, memory honoring `records_trajectory()`, and recovery.

`dispatch_tool` uses the pipeline first if configured, else the registry, and every call is panic-isolated with `catch_unwind`. An unknown tool becomes a soft error listing available names.

The pipeline core in `middleware/tool_call.rs` checks the cancel signal before invoking the tool (0.3.2), so a pre-cancelled call never starts, deterministically rather than by `select!` branch luck.

`recovery_wait_or_return` reflects, decides, and backs off cancel-aware for you, and the `attempt > 5` ceiling raises `ToolRecoveryExhausted`.

`apply_correction_if_present` swaps input or tool, and failed corrections are logged and dropped.

`record_tool_memory` writes your trajectory entries, truncated at 500 characters, after successful calls only.

## Behavior notes

Side effects, meaning observers, hooks, detection, and health, fire per attempt in both modes.

Your engine stamps `tool_call_id` after the pipeline returns, so middleware ids are advisory.

The breaker gate keys on the requested name, while `health_key` records under the resolved name.

Deep dive: [Tool dispatch](/engine/tool-dispatch/).
