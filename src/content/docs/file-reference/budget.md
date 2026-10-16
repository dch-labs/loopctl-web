---
title: "src/budget.rs"
---

This file holds spend accumulation with soft and hard lines per dimension, following the rule that budgets are gates.

It is engine-side and consulted before each model request. You install it per loop with `BareLoop::with_budget_gate(gate)`, which takes the gate by value, so accounting is per-loop and local to each loop. There is no feature flag.

## Key items

`BudgetLimits { turns, tokens, duration }` holds your per-dimension lines, and `None` disables a dimension.

`BudgetGate::new(limits)` builds the gate, and `with_soft_fraction(f)` sets the soft line as a fraction of the hard limit, defaulting to 80%.

An out-of-range fraction, or one below the `0.0001` rationalization floor, is a loud `InvalidInput`.

The gate gives you `begin()` at run start, `observe_usage(in, out)` for real usage records only and never estimates, and `observe_turn_end()`.

`pre_request(elapsed) -> (Vec<BudgetWarn>, Option<HardCrossing>)` is your engine's consult. It returns the warnings raised and an optional `HardCrossing`.

`parse_duration(text)` runs the number-then-unit grammar over `s`, `m`, and `h`, so you can write `90s` or `1h30m`.

`BudgetDimension`, `BudgetWarn`, and `HardCrossing` are the vocabulary types.

## Behavior notes

Soft crossings warn exactly once per run per dimension through `on_budget_warn`. Every enabled dimension latches in the same check, and the tokens, turns, wall-clock priority picks only the refusal.

The hard line refuses your next request before it is sent, surfacing as `LoopError::BudgetExhausted { dimension, spent, limit }`.

That crossing also mints a `GateDecision` deny record under rule `budget.hard`, on the shared gate-decision trail.

The soft-line arithmetic is exact integer math on the fraction's rational form, so your warn can never trail the refusal.

The gate itself never reads a clock. Wall-clock spend arrives as the elapsed argument, so replayed runs cross the same lines at the same logical instants.

For the deep dive, see [The budget gate](/safety/budget-gate/).
