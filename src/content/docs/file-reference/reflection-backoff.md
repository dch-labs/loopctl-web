---
title: "`src/reflection/backoff.rs` — `ExponentialBackoffRecovery`"
---


The default recovery strategy: retry recoverable failures with exponentially growing delays.

**Key items**

- `ExponentialBackoffRecovery::new(max_retries)` — base delay 100ms, max delay 30s; builders `with_base_delay`, `with_max_delay`.
- Delay formula: `base × 2^attempt`, clamped to max, all saturating (no overflow at absurd attempt numbers).

**Behavior notes**

- Decision order: non-recoverable → Fail; past effective retries (`min(strategy's, engine's max)`) → Fail; **High severity with a correction available → AskUser**; else Retry.
- The engine's hard ceiling (`MAX_RECOVERY_ATTEMPTS = 5`) overrides the strategy — the strategy is told the same number as `max_attempts`.
- Default construction is `new(3)`: 3 retries, 100ms → 200ms → 400ms, cancel-aware waits.

Deep dive: [Reflection](/safety/reflection/).
