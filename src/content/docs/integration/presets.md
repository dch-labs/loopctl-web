---
title: "Presets, and the default that became one"
sidebar:
  order: 4
---

Two profiles encode hard-won tuning for the two worlds agents live in. Frontier models are big, capable, and expensive. Constrained models are small, local, cheap, and easily distracted.

Since 0.4.0 the boundary moved. The small-model profile is what default construction wires, which means `BareLoop::new` installs the builtin-verified pipeline, the goal reminder, and, where the client declares support, strict tool-calls.

`FrontierProfile` is now the named opt-out. The crate's positioning of being small-model-ready by default is present-tense true.

The sources are `src/presets.rs` and `src/engine/bare/config.rs`.

## The default wiring: what BareLoop::new installs

Every public constructor over a fresh machine calls `wire_default_profile`, which installs exactly three things:

1. **The builtin-verified pipeline.** It goes into the vacant seam only, so a pipeline your `LoopManagers` already carries is kept untouched. That means `with_pipeline` composes with the default instead of being clobbered.

   The stack is output cap, then verify, then memoize, and it now ships real builtins. `CommandVerifier` judges write-class calls statically, with deny-globs on shell commands and target-path checks on writes, and `WritePathExtractor` makes memoize invalidation file-aware. The no-op placeholders are gone.

2. **A `GoalReminder` contributor** re-injecting your original request past the default cadence.

3. **The strict tool-call constraint,** but only when the client's `supports_tool_constraints()` probe says your client enforces tool schemas. A mock or custom client that answers `false` is left unconstrained rather than lied to.

Every seam is the public one a host would call, so a later host call replaces or composes on top exactly as before.

A resumed machine past `Start` is left untouched. Your checkpoint's loop was configured before serialization, and re-wiring it would change the resumed run's shape.

## ConstrainedProfile: the explicit small-model kit

The profile still exists as the explicit, self-documenting shape, and it is the source of the defaults above.

| Assumption | Counter-measure |
|---|---|
| Your model drifts off goal | A `GoalReminder` contributor re-sends the original task every 5 turns |
| It repeats read-only calls | A memoize layer caches `Read`, `Glob`, and `Grep` with a TTL of 5 turns and path-aware invalidation |
| It ships broken edits | A verify layer after `Write`, `Edit`, and `MultiEdit`, which is real since 0.4.0 |
| It emits fat or loose payloads | An output cap of 16,384 chars, strict tool schemas, and a tight context window |

Applying it explicitly is still the shape for custom composition:

```rust
use loopctl::presets::ConstrainedProfile;

let mut agent = BareLoop::new(
    client,
    tools,
    ConstrainedProfile::session_config(),      // context window 32,768
);
agent.set_request_options(ConstrainedProfile::request_options());  // ToolConstraint::Strict
ConstrainedProfile::apply(&mut agent)?;        // compaction manager + middleware + reminder
let result = agent.run(task, &ConstrainedProfile::run_config()).await?;  // max 100 turns
```

Three pieces reach the loop three ways: config at construction, options via a setter, and `apply()` for everything that needs the live loop.

`apply()` itself runs exactly three steps in order:

1. Build a `ContextManager` around the default truncating compactor, synced to your session's window and threshold.
2. Install the middleware pipeline.
3. Register the goal-reminder contributor.

It deliberately does not touch your loop's config or request options, because those are the other two pieces.

The pipeline it builds, in order with the first being outermost:

```text
OutputLimitMiddleware(16_384)     ← caps everything below
VerifyMiddleware(CommandVerifier) ← appends [verify] blocks after writes (real, 0.4.0)
MemoizingMiddleware(TTL 5)        ← caches raw results innermost, path-aware
[core: your registry]
```

The order is the design. Memoize sits innermost and caches the raw result, so your cache never holds verify text and every write is verified anew. The cap sits outermost and truncates the combined output, so verify diagnostics cannot escape the cap.

One gotcha: middleware you chain onto `pipeline_builder()` lands inside the memoize layer, and that is the wrong slot for anything that must see the original call, such as redaction. Add such layers when you install the pipeline, after the preset's layers.

## FrontierProfile: now the explicit opt-out

This profile is everything plain: a 200k window, 200 turns, and no pipeline, no reminder, and no constraints, which are the v0.1.0-style defaults.

Since the flip, this is the profile a frontier-model user reaches for to remove the small-model machinery. It stays a self-documenting choice rather than an omission.

## GoalReminder: useful on its own

This is the shipped contributor behind the profile's anti-drift measure, and since 0.4.0 it is default-wired as described above:

```rust
agent.add_contributor(Box::new(GoalReminder::new(5)));
```

It re-emits your first user message verbatim as a system reminder every N turns. It skips turn 0, and `n: 0` disables it. Sensible values run from 3 to 10. See [contributors](/extensions/contributors/).

## Which profile when

| Situation | Profile |
|---|---|
| A 7B to 30B local model in a coding agent | The defaults already are Constrained, and `ConstrainedProfile` makes them explicit |
| A frontier API model, meaning a GPT-4o, Claude, or Gemini class model | `FrontierProfile`, which removes the small-model machinery, so you add layers one at a time as problems appear |
| A frontier model doing lots of file reading | Frontier plus your own memoize layer |
| Any model whose writes you must trust | Keep the default verify layer or bring your own `Verifier` |

## Related pages

- [Middleware](/safety/middleware/) covers the layers the profile stacks.
- [Contributors](/extensions/contributors/) is GoalReminder's home turf.
- [Session config](/core-data/session-config/) explains what your 32k window means.
