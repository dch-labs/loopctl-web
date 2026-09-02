---
title: "`src/engine/bare.rs` — the `BareLoop` driver"
---


The hands: the run loop, the three handlers, `finalize`, and the loop's own state. (~1,600 lines; a facade over its submodules since the big split.)

**Key items**

- Constructors: `new` (empty bundle), `new_with_managers` (seeds a default `ContextManager` if none), `from_machine`/`into_machine` (checkpoint/resume).
- The `Loop` impl: `run` (the match loop), `finalize` (commit/discard, memory consolidation, stale-stop cleanup, run-end events, cancel re-arm), `should_continue`, `state`, `cancel`, `stop_reason`.
- The three handlers: `handle_call_llm` (transients → deferral check → `do_turn` → detection → feed), `handle_call_tools` (preresolved slots + dispatch → one results message), `handle_compact` (thin, delegates to `bare/compact.rs`).
- `set_error_state` — Cancelled routes through `machine.cancel()`, everything else through `machine.fail()`.
- Internals: `machine_policy()`, `count_context`, `overhead_tokens` (OnceLock-cached), `MAX_RECOVERY_ATTEMPTS = 5`, `detection_disabled` (sticky, set on detection poison).
- Accessors: `conversation`, `session`, `run_config`, `tools`, `machine`, `cancel_signal`, `is_cancelled`, `turn_mode`.

**Behavior notes**

- The deferral dance: a turn whose fuller payload (with transients) crosses the compaction line defers silently — no turn events — and reserves `deferred_transient_tokens` so the retried turn fits.
- `into_machine`/drop removes the managed session temp dir (best-effort).
- The `Done` arm matches every outcome variant explicitly — future variants force a compile error here.

Deep dive: [The driver loop](/engine/driver-loop/).
