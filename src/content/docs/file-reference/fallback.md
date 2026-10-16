---
title: "src/fallback.rs"
---

This file counts model failures, switches to your backup models, and probes the primary for recovery. It runs about 2,100 lines with tests.

## Key items

`FallbackState` is `Primary`, `Fallback`, or `Recovering`. During recovery, transient failures stack toward a re-trip at `trip_threshold` since 0.4.0, so a dying primary no longer keeps the probe alive.

Your model-name setters reject blank names, and an empty chain fails closed rather than serving the known-bad primary.

`FallbackConfig` ships a trip threshold of 3, where 0 trips on first failure, plus recovery timeout 60s, recovery successes 2, and per-model max fails 2.

Chain management covers `set_fallback_model`, `set_fallback_models`, `add_fallback_model`, `insert_fallback_model`, `remove_fallback_model`, `fallback_models()`, and `fallback_model()`, which picks the first healthy entry. You also get `mark_fallback_failed` and `set_fallback_available`.

Recording runs through `record_failure(kind)`, which returns `true` if this call tripped, plus `record_success()`, `reset_failure_counter()`, and `reset()`.

Model selection covers `original_model` and `set_original_model`, then `active_model()`, which is `None` when your configured chain is exhausted and never silently back to the bad primary.

`should_try_resume_primary` and `transition_to_recovering` drive the probe. `FailureKind { Transient, RateLimit }` only matters during recovery: rate-limit re-trips, and transient resets the probe streak.

## Behavior notes

One mutex covers all state, so every read-modify-write is atomic. Poison fails closed as `LockPoisoned { what: "fallback" }`.

Tripping resets the counters, which gives Fallback a fresh slate, and a recovery close clears every chain entry's attempts.

Your engine applies routing as a per-request model override, so the shared client is never mutated.

Deep dive: [Fallback](/safety/fallback/).
