---
title: "src/engine/bare.rs"
---

This file is the hands behind `BareLoop`. It holds the run loop, the three handlers, `finalize`, and the loop's own state.

It runs to about 1,800 lines, and it has been a facade over its submodules since the big split.

## Key items

Your constructors are `new` for an empty bundle and `new_with_managers`, which seeds a default `ContextManager` if none is present.

`from_machine` and `into_machine` handle your checkpoint and resume. `from_machine_with_managers` arrived in 0.3.2 and resumes while keeping your `LoopManagers`, so your observer host, dispatch pipeline, and context manager all survive.

By contrast `from_machine` builds a fresh bundle and drops every observer you installed, and a bundle carrying no context manager gets the session-synced default, which matches `new_with_managers`.

Under the `Loop` impl you get `run`, which is the match loop, and `finalize`.

`finalize` has had three-way retention since 0.4.0: success commits, a cancel or ordinary failure salvages the coherent prefix, and `ContextExceeded` discards. It also runs memory consolidation, stale-stop cleanup, run-end events, and cancel re-arm.

The rest of the impl is `should_continue`, `state`, `cancel`, and `stop_reason`.

The default profile wiring arrived in 0.4.0 as `wire_default_profile`, which every public constructor runs over a fresh machine. It installs the builtin-verified pipeline into the vacant seam only, a `GoalReminder`, and strict tool-calls when `supports_tool_constraints()` agrees.

A resumed machine past `Start` is left untouched, and `FrontierProfile` is your opt-out.

The run-start gauntlet also arrived in 0.4.0. It resolves your window, probe over declaration, frozen for the run and cancel-raced, and it resets the overflow-salvage budget.

It also consults your budget gate and runs the prune pass at the pre-request site in `prune.rs`.

The three handlers are `handle_call_llm`, which goes transients, then deferral check, then `do_turn`, then detection, then feed, and `handle_call_tools`, which fills preresolved slots, dispatches, and builds one results message.

The third is `handle_compact`, which is thin and delegates to `bare/compact.rs`.

`set_error_state` routes Cancelled through `machine.cancel()` and everything else through `machine.fail()`.

The internals are `machine_policy()`, `count_context`, `overhead_tokens`, which is OnceLock-cached, `MAX_RECOVERY_ATTEMPTS = 5`, and `detection_disabled`, which is sticky and set on detection poison.

Your accessors are `conversation`, `session`, `run_config`, `tools`, `machine`, `cancel_signal`, `is_cancelled`, and `turn_mode`.

## Behavior notes

Watch the deferral dance. A turn whose fuller payload with transients crosses the compaction line defers silently, with no turn events, and reserves `deferred_transient_tokens` so the retried turn fits.

`into_machine` and drop remove the managed session temp dir on a best-effort basis.

The `Done` arm matches every outcome variant explicitly, so a future variant forces a compile error here rather than slipping through.

For the deep dive, see [The driver loop](/engine/driver-loop/).
