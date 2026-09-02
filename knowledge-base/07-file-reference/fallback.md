# `src/fallback.rs` — the model circuit breaker

Counts model failures, switches to backup models, probes the primary for recovery. (~2,100 lines with tests.)

**Key items**

- `FallbackState` — `Primary`, `Fallback`, `Recovering`.
- `FallbackConfig` — trip threshold 3 (**0 trips on first failure**), recovery timeout 60s, recovery successes 2, per-model max fails 2.
- Chain management: `set_fallback_model(s)`, `add_/insert_/remove_fallback_model`, `fallback_models()`, `fallback_model()` (first healthy), `mark_fallback_failed`, `set_fallback_available`.
- Recording: `record_failure(kind)` (returns `true` if this call tripped), `record_success()`, `reset_failure_counter()`, `reset()`.
- Model selection: `original_model`/`set_original_model`, `active_model()` (`None` when a configured chain is exhausted — never silently back to the bad primary), `should_try_resume_primary`, `transition_to_recovering`.
- `FailureKind { Transient, RateLimit }` — only matters during recovery: rate-limit re-trips, transient just resets the probe streak.

**Behavior notes**

- One mutex over all state — every read-modify-write is atomic; poison fails closed as `LockPoisoned { what: "fallback" }`.
- Trip resets the counters (fresh slate in Fallback); recovery close clears every chain entry's attempts.
- The engine applies routing as a per-request model override; the shared client is never mutated.

Deep dive: [Fallback](../03-safety/04-fallback.md).
