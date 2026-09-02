---
title: "`src/presets.rs` — curated profiles"
---


Two settings bundles encoding tuning for frontier vs small models, plus the shipped contributor.

**Key items**

- `ConstrainedProfile` — `session_config()` (32,768 window), `run_config()` (max 100 turns), `request_options()` (`ToolConstraint::Strict`), `pipeline_builder()` (output-limit → verify → memoize), `apply(&mut agent)` (installs context manager + pipeline + reminder).
- `FrontierProfile` — everything default; the explicit baseline.
- `GoalReminder::new(n)` — re-emits the first user message as a system reminder every n turns (skips turn 0; `0` disables).
- Constants: `OUTPUT_CAP_CHARS = 16_384`, `MEMOIZE_TTL_TURNS = 5`, write tools `["Write","Edit","MultiEdit"]`, memoized tools `["Read","Glob","Grep","LS"]`.

**Behavior notes**

- The pipeline order is the design: memoize innermost caches raw results; the cap outermost bounds everything below (verify diagnostics can't escape).
- `NoopVerifier`/`NoopPathExtractor` are wired by default — functional out of the box, meant to be swapped for real ones.
- Host middleware chained onto `pipeline_builder()` lands **inside** the memoize layer — the wrong slot for anything that must see original calls.
- `apply()` does not set config or request options — those are separate, deliberate wiring steps.

Deep dive: [Presets](/integration/presets/).
