---
title: "The budget gate — spend lines the engine refuses to cross"
sidebar:
  order: 10
---


"Budgets are gates": spend accumulation with **soft** and **hard** lines per dimension, consulted engine-side before each turn's model request. One `BudgetGate` (`src/budget.rs`), installed with `BareLoop::with_budget_gate(...)` — no middleware, no feature flag, no manifest-type change.

**Read this if:** a run must stop at N tokens / N turns / N minutes — not "eventually, if something notices," but *refused before the next request is sent*.

---

## The three dimensions

| Dimension | Measured by | Notes |
|---|---|---|
| `Tokens` | provider-reported `input + output` from usage records — **never estimates** | usage-less turns contribute nothing (the honest count, not a guess) |
| `Turns` | completed turns, counted at turn end | an in-flight turn never counts against itself |
| `Duration` | the elapsed reading of the caller's clock seam, passed in as a `Duration` | the gate itself never reads a clock — a replayed run crosses the same lines at the same logical instants |

`BudgetLimits { turns, tokens, duration }` — `None` (the default) disables a dimension's lines entirely.

## Soft line, hard line

Per dimension, two thresholds:

- **Soft line** — a fraction of the hard limit, default **80%**, movable via `with_soft_fraction(f)` (validated: out-of-range — including below the `0.0001` rationalization floor — is a loud `InvalidInput`, never clamped). Crossing it fires **`on_budget_warn`** (`BudgetWarnContext`, forwarded by the event hub as `LoopEvent::BudgetWarn`) **exactly once per run per dimension**, however many checks pass between the lines.
- **Hard line** — refuses the **next request before it is sent** (the litellm `max_budget` shape): the turn fails with the non-recoverable `LoopError::BudgetExhausted { dimension, spent, limit }` (the `MaxTurnsExceeded` precedent, with numbers for diagnostics) and mints a `GateDecision` deny record (rule id `budget.hard`, rule source middleware, tool `model_request`, reason naming the dimension and numbers) onto the same gate-decision trail every other gate writes — audit and replay see budget enforcement like any gate.

A spend rocketing past both lines in one response still records its warn alongside the refusal. Every enabled dimension latches its warn in the same check; the tokens → turns → wall-clock priority picks only the refusal.

## The arithmetic — exact, by construction

The soft line is computed with exact integer math on the fraction's four-decimal rational form — no float casts, no rounding above the product, a `u128` intermediate that cannot saturate below it — **so the warn can never trail the refusal**. (Pinned by a sweep of limits 1..100,000 × fractions 0.1..1.0.)

The duration grammar (also exposed as `parse_duration` for hosts): number-then-unit pairs over `s`/`m`/`h` — `90s`, `5m`, `4h`, `1h30m`, `2h45m10s`; garbage is a loud `InvalidInput`.

## How the engine wires it

```text
run start:   gate.begin()                     — counters reset for this run
each turn:   pre_request(elapsed) consulted    — BEFORE the request is built
             (warns latch, a hard crossing refuses)
on usage:    gate.observe_usage(in, out)       — from real usage records
turn end:    gate.observe_turn_end()
```

Accounting is local to each loop by construction (`with_budget_gate` takes the gate by value): a second loop nested inside the first's tool dispatch, spending under its own gate, never shortens the first loop's served requests.

The manifest's advisory `Budgets` stanza maps into `BudgetLimits` behind the `manifest` feature, with `cost_usd` deliberately mapping to nothing — no price table is consulted, so cost has no line (the gate refuses to guess a cost); an unparseable `duration` disables the wall-clock line with a warn rather than guessing.

---

## Related pages

- [Errors](/core-data/errors/) — `BudgetExhausted`.
- [Permissions](/safety/permission/) — the gate-decision records the hard refusal mints.
- [The driver loop](/engine/driver-loop/) — where the consult sits.
- [File reference: budget.rs](/file-reference/budget/)
