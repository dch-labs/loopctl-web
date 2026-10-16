---
title: "The budget gate"
sidebar:
  order: 10
---

A budget gate is a spend line the engine refuses to cross. It accumulates spend on three dimensions and consults them engine-side, before each turn's model request.

Read this when a run must stop at N tokens, N turns, or N minutes. Not "eventually, if something notices", but refused before the next request goes out. Source: `src/budget.rs`.

You install one `BudgetGate` with `BareLoop::with_budget_gate(...)`. It is not middleware, it needs no feature flag, and it changes no manifest type.

## The three dimensions

| Dimension | Measured by | Notes |
|---|---|---|
| `Tokens` | Provider-reported `input + output` from usage records, never estimates | Usage-less turns contribute nothing. That is the honest count rather than a guess. |
| `Turns` | Completed turns, counted at turn end | An in-flight turn never counts against itself. |
| `Duration` | The elapsed reading of your clock seam, passed in as a `Duration` | The gate never reads a clock, so a replayed run crosses the same lines at the same logical instants. |

You hand the gate a `BudgetLimits { turns, tokens, duration }`. Each field defaults to `None`, and a `None` disables that dimension's lines entirely.

## Two lines per dimension

### The soft line

The soft line is a fraction of the hard limit, default 80%. Move it with `with_soft_fraction(f)`, which validates rather than clamps. An out-of-range value is a loud `InvalidInput`, including anything below the `0.0001` rationalization floor.

Crossing the soft line fires `on_budget_warn` exactly once per run per dimension. Your handler receives a `BudgetWarnContext`, and the event hub forwards it as `LoopEvent::BudgetWarn`. The one-shot rule holds however many checks pass between the two lines.

### The hard line

The hard line refuses the next request before it is sent, which is the shape litellm's `max_budget` has. The turn fails with `LoopError::BudgetExhausted { dimension, spent, limit }`, and that error is not recoverable.

It follows the `MaxTurnsExceeded` precedent and carries the numbers, so your diagnostics can name the spend and the limit.

The refusal also mints a `GateDecision` deny record. It carries rule id `budget.hard`, rule source `middleware`, tool `model_request`, and a reason naming the dimension and the numbers. It lands on the same gate-decision trail every other gate writes, so your audit and replay see budget enforcement like any other gate.

Two details about a large spend. A response that rockets past both lines in one step still records its warn alongside the refusal. And every enabled dimension latches its warn in the same check, while the `tokens → turns → wall-clock` priority picks only which refusal you get.

## The arithmetic

The soft line is computed with exact integer math on the fraction's four-decimal rational form. There are no float casts, no rounding above the product, and a `u128` intermediate that cannot saturate below it. So the warn can never trail the refusal.

That is pinned by a sweep of limits 1..100,000 × fractions `0.1..1.0`.

A sweep of limits 1 to 100,000 against fractions 0.1 to 1.0 pins that property.

### Duration grammar

You can write durations as number-then-unit pairs over `s`, `m`, and `h`: `90s`, `5m`, `4h`, `1h30m`, `2h45m10s`. The same parser is exposed as `parse_duration` for your own host code. Garbage is a loud `InvalidInput`.

## How the engine wires it

Four hook points, in order:

```text
run start:   gate.begin()                     — counters reset for this run
each turn:   pre_request(elapsed) consulted    — BEFORE the request is built
             (warns latch, a hard crossing refuses)
on usage:    gate.observe_usage(in, out)       — from real usage records
turn end:    gate.observe_turn_end()
```

Accounting is local to each loop by construction, because `with_budget_gate` takes the gate by value. A second loop nested inside the first one's tool dispatch spends under its own gate and never shortens the requests the first loop has left.

The manifest's advisory `Budgets` stanza maps into `BudgetLimits` behind the `manifest` feature. Two choices there are deliberate:

- `cost_usd` maps to nothing. No price table is consulted, so cost has no line. The gate refuses to guess a cost.
- An unparseable `duration` disables the wall-clock line with a warn, rather than guessing what you meant.

## Related pages

- [Errors](/core-data/errors/) covers `BudgetExhausted`.
- [Permissions](/safety/permission/) covers the gate-decision records a hard refusal mints.
- [The driver loop](/engine/driver-loop/) covers where the consult sits.
- [File reference: budget.rs](/file-reference/budget/)
