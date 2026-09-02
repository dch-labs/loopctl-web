# Presets — curated settings for two kinds of models

Two profiles encode hard-won tuning for the two worlds agents live in: **frontier models** (big, capable, expensive) and **constrained models** (small, local, cheap — and easily distracted). Source: `src/presets.rs`.

---

## `ConstrainedProfile` — the small-model kit

Built on four assumptions about small models: they drift off goal, repeat tool calls, ship broken edits, and emit malformed arguments. Each assumption gets a counter-measure:

| Assumption | Counter-measure |
|---|---|
| drifts off goal | a `GoalReminder` contributor re-sends the original task every 5 turns |
| repeats read-only calls | a memoize layer caching `Read`/`Glob`/`Grep`/`LS` (TTL 5 turns) |
| ships broken edits | a verify layer after `Write`/`Edit`/`MultiEdit` |
| emits fat/loose payloads | output cap (16,384 chars), strict tool schemas, tight context window |

Applying it:

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

Three pieces, three ways they reach the loop — config at construction, options via setter, and `apply()` for everything that needs the live loop. `apply()` itself runs exactly three steps, in order: (1) build a `ContextManager` around the default truncating compactor, **synced to the session's window and threshold** (whatever the constructor seeded is replaced by the values your `SessionConfig` actually carries); (2) install the middleware pipeline; (3) register the goal-reminder contributor. It deliberately does *not* touch the loop's config or request options — those are the other two pieces, and keeping them separate means the profile composes with your own construction code instead of fighting it.

The pipeline it builds, in order (first = outermost):

```text
OutputLimitMiddleware(16_384)     ← caps everything below
VerifyMiddleware(NoopVerifier)    ← appends [verify] blocks after writes
MemoizingMiddleware(TTL 5)        ← caches raw results innermost
[core: your registry]
```

The order is the design: memoize innermost caches the **raw** result (cache never holds verify text; every write is verified anew); the cap outermost truncates the **combined** output (verify diagnostics can't escape the cap).

**The upgrade path is deliberate:** `NoopVerifier` verifies nothing until you swap in a real one (cargo check, tsc, your test suite) — then every agent write gets proven or disproven on the spot. Same for the `NoopPathExtractor`: replace it with a real path extractor and cache invalidation becomes file-aware.

> **Gotcha:** middleware you chain onto `pipeline_builder()` lands **inside** the memoize layer — the wrong slot for anything that must see the original call (e.g. redaction). Add such layers when installing the pipeline, after the preset's layers.

## `FrontierProfile` — the explicit baseline

Everything default: 200k window, 200 turns, no pipeline, no constraints. It exists so "no profile" can be an explicit, self-documenting choice rather than an omission.

## `GoalReminder` — useful on its own

The shipped contributor behind the profile's anti-drift measure:

```rust
agent.add_contributor(Box::new(GoalReminder::new(5)));
```

Re-emits the **first user message** verbatim as a system reminder every N turns (skipping turn 0; `n: 0` disables). Sensible values 3–10. See [contributors](../04-extensions/04-contributors.md).

---

## Which profile when

| Situation | Profile |
|---|---|
| 7B–30B local model, coding agent | Constrained |
| Frontier API model (GPT-4o / Claude / Gemini class) | Frontier — add layers à la carte as problems appear |
| Frontier model doing lots of file reading | Frontier + your own memoize layer |
| Any model whose writes you must trust | Either + a real `Verifier` |

---

## Related pages

- [Middleware](../03-safety/01-middleware.md) — the layers the profile stacks.
- [Contributors](../04-extensions/04-contributors.md) — GoalReminder's home turf.
- [Session config](../01-core-data/06-session-config.md) — what the 32k window means.
