# Presets — and the default that became one

Two profiles encode hard-won tuning for the two worlds agents live in: **frontier models** (big, capable, expensive) and **constrained models** (small, local, cheap — and easily distracted). Since 0.4.0 the boundary moved: **the small-model profile is what default construction wires** — `BareLoop::new` installs the builtin-verified pipeline, the goal reminder, and (where the client declares support) strict tool-calls — and `FrontierProfile` is the named **opt-out**. The crate's positioning (“small-model-ready by default”) is present-tense true. Source: `src/presets.rs`, `src/engine/bare/config.rs`.

---

## The default wiring (0.4.0) — what `BareLoop::new` now installs

Every public constructor over a fresh machine calls `wire_default_profile`, which installs exactly three things:

1. **The builtin-verified pipeline** (only into the *vacant* seam — a pipeline your `LoopManagers` already carries is kept untouched, so `with_pipeline` composes with the default instead of being clobbered): output cap → verify → memoize, now with **real** builtins — `CommandVerifier` judges write-class calls statically (deny-globs on shell commands, target-path checks on writes) and `WritePathExtractor` makes memoize invalidation file-aware. The no-op placeholders are gone.
2. **A `GoalReminder` contributor** re-injecting the original request past the default cadence.
3. **The strict tool-call constraint** — but only when the client's `supports_tool_constraints()` probe says the client enforces tool schemas (a mock or custom client that answers `false` is left unconstrained, not lied to).

Every seam is the public one a host would call, so a later host call replaces or composes on top exactly as before. A **resumed machine past `Start` is left untouched** — the checkpoint's loop was configured before serialization, and re-wiring it would change the resumed run's shape.

## `ConstrainedProfile` — the explicit small-model kit

The profile still exists as the explicit, self-documenting shape (and the source of the defaults above):

| Assumption | Counter-measure |
|---|---|
| drifts off goal | a `GoalReminder` contributor re-sends the original task every 5 turns |
| repeats read-only calls | a memoize layer caching `Read`/`Glob`/`Grep` (TTL 5 turns, path-aware invalidation) |
| ships broken edits | a verify layer after `Write`/`Edit`/`MultiEdit` — real since 0.4.0 |
| emits fat/loose payloads | output cap (16,384 chars), strict tool schemas, tight context window |

Applying it explicitly (still the shape for custom composition):

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

Three pieces, three ways they reach the loop — config at construction, options via setter, and `apply()` for everything that needs the live loop. `apply()` itself runs exactly three steps, in order: (1) build a `ContextManager` around the default truncating compactor, **synced to the session's window and threshold**; (2) install the middleware pipeline; (3) register the goal-reminder contributor. It deliberately does *not* touch the loop's config or request options — those are the other two pieces.

The pipeline it builds, in order (first = outermost):

```text
OutputLimitMiddleware(16_384)     ← caps everything below
VerifyMiddleware(CommandVerifier) ← appends [verify] blocks after writes (real, 0.4.0)
MemoizingMiddleware(TTL 5)        ← caches raw results innermost, path-aware
[core: your registry]
```

The order is the design: memoize innermost caches the **raw** result (cache never holds verify text; every write is verified anew); the cap outermost truncates the **combined** output (verify diagnostics can't escape the cap).

> **Gotcha:** middleware you chain onto `pipeline_builder()` lands **inside** the memoize layer — the wrong slot for anything that must see the original call (e.g. redaction). Add such layers when installing the pipeline, after the preset's layers.

## `FrontierProfile` — now the explicit opt-out

Everything plain: 200k window, 200 turns, **no pipeline, no reminder, no constraints** — the v0.1.0-style defaults. Since the flip, this is the profile a frontier-model user reaches for to *remove* the small-model machinery, and it remains a self-documenting choice rather than an omission.

## `GoalReminder` — useful on its own

The shipped contributor behind the profile's anti-drift measure — and since 0.4.0, default-wired (see above):

```rust
agent.add_contributor(Box::new(GoalReminder::new(5)));
```

Re-emits the **first user message** verbatim as a system reminder every N turns (skipping turn 0; `n: 0` disables). Sensible values 3–10. See [contributors](../04-extensions/04-contributors.md).

---

## Which profile when

| Situation | Profile |
|---|---|
| 7B–30B local model, coding agent | the defaults already are Constrained — `ConstrainedProfile` makes them explicit |
| Frontier API model (GPT-4o / Claude / Gemini class) | `FrontierProfile` — remove the small-model machinery, add layers à la carte as problems appear |
| Frontier model doing lots of file reading | Frontier + your own memoize layer |
| Any model whose writes you must trust | keep the default verify layer or bring your own `Verifier` |

---

## Related pages

- [Middleware](../03-safety/01-middleware.md) — the layers the profile stacks.
- [Contributors](../04-extensions/04-contributors.md) — GoalReminder's home turf.
- [Session config](../01-core-data/06-session-config.md) — what the 32k window means.
