---
title: "`src/tool/health.rs` — per-tool health and breakers [feature: tool_health]"
---


Lock-free stats plus a mutex-guarded circuit breaker per tool, aggregated in one registry.

**Key items**

- `ToolStats` — atomic counters; `health_score() = 0.3×success_rate + 0.7×ewma`; EWMA decay 0.7, starts optimistic at 1.0; avg/max durations (max includes failures).
- `HealthStatus` — Healthy (≥0.8) / Degraded (≥0.5) / Unhealthy; **breaker-open always Unhealthy**.
- `ToolCircuitBreaker` — Closed/Open/HalfOpen; `CircuitBreakerConfig { failure_threshold: 3, recovery_duration: 30s, probe_timeout: 30s }`; `allow_request` (mutating — grants the single probe), `would_allow_request` (pure), `record_success/failure`.
- `ToolHealthRegistry` — `new`/`with_config`, `get_stats`/`get_circuit_breaker` (auto-register), `allow_request`, `is_tool_available` (pure), `record_success/failure`, `health_summary`.
- `HealthRouter`/`HealthRouterBuilder` — route to a healthy substitute instead of refusing.

**Behavior notes**

- Single-flight probing with a **lease**: an expired probe re-arms the cooldown instead of wedging HalfOpen; the pure oracle and the mutating gate agree at every instant.
- Stale results handled: success while Open ignored; late success after lease expiry re-arms; late failure restarts the cooldown.
- Zero threshold *disables* tripping (counting continues).
- The engine's gate keys on the requested name; records key on the resolved name — identical for non-renaming pipelines.

Deep dive: [Tool health](/safety/tool-health/).
