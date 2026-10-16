---
title: "src/reflection/backoff.rs"
---

This file holds your default recovery strategy: it retries recoverable failures with exponentially growing delays. Read it before you write a custom strategy, because the ordering here is the ordering your engine expects.

## Key items

You build it with `ExponentialBackoffRecovery::new(max_retries)`, which starts at a base delay of 100ms and a max delay of 30s. Tune either with the `with_base_delay` and `with_max_delay` builders.

Your delay formula is `base × 2^attempt`, clamped to max, and every step saturates so absurd attempt numbers cannot overflow.

## Behavior notes

Decision order runs like this: a non-recoverable failure means Fail. Past your effective retries, which is `min(strategy's, engine's max)`, means Fail. High severity with a correction available means AskUser. Everything else earns you a Retry.

Your engine's hard ceiling (`MAX_RECOVERY_ATTEMPTS = 5`) overrides the strategy, and the strategy is told the same number as `max_attempts`.

Default construction is `new(3)`, which gives you 3 retries at 100ms, 200ms, then 400ms, with cancel-aware waits.

Deep dive: [Reflection](/safety/reflection/).
