---
title: "src/tool/health.rs"
---

This file gives you lock-free stats plus a mutex-guarded per-tool circuit breaker, aggregated in one registry, under the `tool_health` feature.

## Key items

`ToolStats` holds atomic counters and computes `health_score() = 0.3×success_rate + 0.7×ewma`. EWMA decay is 0.7, it starts optimistic at 1.0, and avg/max durations are tracked, where max includes failures.

`HealthStatus` is Healthy at 0.8 or better, Degraded at 0.5 or better, and Unhealthy below. Breaker-open is always Unhealthy.

`ToolCircuitBreaker` runs Closed, Open, and HalfOpen with `CircuitBreakerConfig { failure_threshold: 3, recovery_duration: 30s, probe_timeout: 30s }`.

Use `allow_request`, which mutates and grants the single probe, `would_allow_request`, which stays pure, and `record_success` plus `record_failure`.

`ToolHealthRegistry` gives you `new` and `with_config`, then `get_stats` and `get_circuit_breaker`, which auto-register. It also gives you `allow_request`, `is_tool_available`, `record_success`, `record_failure`, and `health_summary`.

`HealthRouter` and `HealthRouterBuilder` route you to a healthy substitute instead of refusing.

## Behavior notes

Probing is single-flight with a lease: an expired probe re-arms the cooldown instead of wedging HalfOpen, and the pure oracle and the mutating gate agree at every instant.

Stale results are handled. Success while Open is ignored, a late success after lease expiry re-arms, and a late failure restarts the cooldown.

Set a zero threshold and you disable tripping, while counting continues.

Your engine's gate keys on the requested name and records key on the resolved name, which are identical for non-renaming pipelines.

Deep dive: [Tool health](/safety/tool-health/).
