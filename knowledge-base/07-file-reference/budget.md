# `src/budget.rs` — the budget gate

Spend accumulation with soft and hard lines per dimension — "budgets are gates." Engine-side (consulted before each model request), installed per-loop with `BareLoop::with_budget_gate(gate)` taking the gate by value, so accounting is local to each loop. No feature flag.

**Key items**

- `BudgetLimits { turns, tokens, duration }` — per-dimension lines; `None` disables a dimension.
- `BudgetGate::new(limits)` / `with_soft_fraction(f)` — the soft line as a fraction of the hard limit (default 80%; out-of-range or below the `0.0001` rationalization floor is a loud `InvalidInput`).
- `begin()` (run start), `observe_usage(in, out)` (real usage records only — never estimates), `observe_turn_end()`, `pre_request(elapsed) -> (Vec<BudgetWarn>, Option<HardCrossing>)` — the engine's consult.
- `parse_duration(text)` — the number-then-unit grammar over `s`/`m`/`h` (`90s`, `1h30m`).
- `BudgetDimension` / `BudgetWarn` / `HardCrossing` — the vocabulary.

**Behavior notes**

- Soft crossings warn exactly once per run per dimension (`on_budget_warn`); every enabled dimension latches in the same check, the tokens → turns → wall-clock priority picks only the refusal.
- The hard line refuses the *next* request before it is sent — `LoopError::BudgetExhausted { dimension, spent, limit }` — and mints a `GateDecision` deny record (rule `budget.hard`) on the shared gate-decision trail.
- The soft-line arithmetic is exact integer math on the fraction's rational form; the warn can never trail the refusal.
- The gate itself never reads a clock — wall-clock spend arrives as the elapsed argument, so replayed runs cross the same lines at the same logical instants.

Deep dive: [The budget gate](../03-safety/10-budget-gate.md)
