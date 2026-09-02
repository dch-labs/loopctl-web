# `src/cancel.rs` — `CancelSignal`

The cooperative cancellation flag, shareable as `Arc<CancelSignal>`, honored at every level of the engine.

**Key items**

- `cancel()` — fire; idempotent; wakes all waiters.
- `is_cancelled()` — non-blocking poll.
- `notified().await` — race-free async wait; completes immediately if already fired.
- `reset()` — swap in a fresh token (the underlying tokio `CancellationToken` is one-shot by design).

**Behavior notes**

- Wraps `tokio_util::sync::CancellationToken` precisely to avoid the check-then-act race of hand-rolled `AtomicBool` + `Notify`.
- The engine re-arms in `finalize()` — after the run observed the cancel — so a cancel arriving *between* runs is observed by exactly one run, then cleared. One cancel can never permanently kill an agent.
- A task already waiting on the old token when `reset()` happens still completes against the old (fired) token.
- Lock poisoning is recovered (single-value data — the `recover_guard` policy).

Deep dive: [Cancellation](../02-engine/05-cancellation.md).
