---
title: "src/presets.rs"
---

This file holds two settings bundles that encode tuning for frontier versus small models, plus the shipped contributor.

## Key items

`ConstrainedProfile` gives you `session_config()` with a 32,768 window and `run_config()` with a max of 100 turns.

It also gives you `pipeline_builder()` and `pipeline_builder_with_builtin_verification()`. Those stack output-limit, verify, and memoize, with real builtins since 0.4.0.

`apply(&mut agent)` installs your context manager, your pipeline, and your reminder.

`FrontierProfile` is everything default, and since 0.4.0 it is the explicit opt-out from the default small-model wiring.

`GoalReminder::new(n)` re-emits your first user message as a system reminder every n turns. It skips turn 0, `0` disables it, and every fresh construction has default-wired it since 0.4.0.

The constants are `OUTPUT_CAP_CHARS = 16_384` and `MEMOIZE_TTL_TURNS = 5`, with write tools `["Write","Edit","MultiEdit"]` and memoized tools `["Read","Glob","Grep"]`.

## Behavior notes

The default wiring landed in 0.4.0. Every public constructor over a fresh machine installs the builtin-verified pipeline into the vacant seam only, and adds the goal reminder.

You also get strict tool-calls when the client's `supports_tool_constraints()` agrees.

`FrontierProfile` removes it all, and a resumed machine past `Start` is never re-wired.

The pipeline order is the design. Memoize sits innermost and caches raw results, while the cap sits outermost and bounds everything below.

So verify diagnostics cannot escape to your caller.

The verify layer runs the real `CommandVerifier` with static deny-globs and path checks, plus `WritePathExtractor` for invalidation, so the no-op placeholders are gone.

Host middleware you chain onto `pipeline_builder()` lands inside the memoize layer, and that is the wrong slot for anything that must see original calls.

`apply()` does not set your config or request options, because those are separate, deliberate wiring steps.

For the deep dive, see [Presets](/integration/presets/).
