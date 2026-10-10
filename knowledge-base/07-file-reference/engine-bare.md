# `src/engine/bare.rs` — the `BareLoop` driver

The hands: the run loop, the three handlers, `finalize`, and the loop's own state. (~1,800 lines; a facade over its submodules since the big split.)

**Key items**

- Constructors: `new` (empty bundle), `new_with_managers` (seeds a default `ContextManager` if none), `from_machine`/`into_machine` (checkpoint/resume), and `from_machine_with_managers` (0.3.2 — resume keeping the caller's `LoopManagers`: observer host, dispatch pipeline, context manager all survive, where `from_machine` builds a fresh bundle and drops every installed observer; a bundle carrying no context manager gets the session-synced default, matching `new_with_managers`).
- The `Loop` impl: `run` (the match loop), `finalize` (three-way retention since 0.4.0 — success commits, cancel/ordinary failure salvages the coherent prefix, `ContextExceeded` discards — plus memory consolidation, stale-stop cleanup, run-end events, cancel re-arm), `should_continue`, `state`, `cancel`, `stop_reason`.
- **The default profile wiring (0.4.0)** — `wire_default_profile`, run by every public constructor over a fresh machine: the builtin-verified pipeline (vacant seam only), a `GoalReminder`, and strict tool-calls when `supports_tool_constraints()` agrees. A resumed machine past `Start` is left untouched; `FrontierProfile` is the opt-out.
- **The run-start gauntlet (0.4.0)** — window resolution (probe over declaration, frozen for the run, cancel-raced) and the overflow-salvage budget reset; plus the budget-gate consult and the prune pass at the pre-request site (`prune.rs`).
- The three handlers: `handle_call_llm` (transients → deferral check → `do_turn` → detection → feed), `handle_call_tools` (preresolved slots + dispatch → one results message), `handle_compact` (thin, delegates to `bare/compact.rs`).
- `set_error_state` — Cancelled routes through `machine.cancel()`, everything else through `machine.fail()`.
- Internals: `machine_policy()`, `count_context`, `overhead_tokens` (OnceLock-cached), `MAX_RECOVERY_ATTEMPTS = 5`, `detection_disabled` (sticky, set on detection poison).
- Accessors: `conversation`, `session`, `run_config`, `tools`, `machine`, `cancel_signal`, `is_cancelled`, `turn_mode`.

**Behavior notes**

- The deferral dance: a turn whose fuller payload (with transients) crosses the compaction line defers silently — no turn events — and reserves `deferred_transient_tokens` so the retried turn fits.
- `into_machine`/drop removes the managed session temp dir (best-effort).
- The `Done` arm matches every outcome variant explicitly — future variants force a compile error here.

Deep dive: [The driver loop](../02-engine/02-driver-loop.md).
