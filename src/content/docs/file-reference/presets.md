---
title: "`src/presets.rs` — curated profiles"
---


Two settings bundles encoding tuning for frontier vs small models, plus the shipped contributor.

**Key items**

- `ConstrainedProfile` — `session_config()` (32,768 window), `run_config()` (max 100 turns), `request_options()` (`ToolConstraint::Strict`), `pipeline_builder()` / `pipeline_builder_with_builtin_verification()` (output-limit → verify → memoize, real builtins since 0.4.0), `apply(&mut agent)` (installs context manager + pipeline + reminder).
- `FrontierProfile` — everything default; **since 0.4.0 the explicit opt-out** from the default small-model wiring.
- `GoalReminder::new(n)` — re-emits the first user message as a system reminder every n turns (skips turn 0; `0` disables); default-wired by every fresh construction since 0.4.0.
- Constants: `OUTPUT_CAP_CHARS = 16_384`, `MEMOIZE_TTL_TURNS = 5`, write tools `["Write","Edit","MultiEdit"]`, memoized tools `["Read","Glob","Grep"]`.

**Behavior notes**

- **The default wiring (0.4.0):** every public constructor over a fresh machine installs the builtin-verified pipeline (into the vacant seam only), the goal reminder, and — when the client's `supports_tool_constraints()` agrees — strict tool-calls. `FrontierProfile` removes it all; a resumed machine past `Start` is never re-wired.
- The pipeline order is the design: memoize innermost caches raw results; the cap outermost bounds everything below (verify diagnostics can't escape).
- The verify layer runs the real `CommandVerifier` (static deny-globs + path checks) with `WritePathExtractor` for invalidation — the no-op placeholders are gone.
- Host middleware chained onto `pipeline_builder()` lands **inside** the memoize layer — the wrong slot for anything that must see original calls.
- `apply()` does not set config or request options — those are separate, deliberate wiring steps.

Deep dive: [Presets](/integration/presets/).
