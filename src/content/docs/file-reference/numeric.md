---
title: "`src/numeric.rs` — internal safe ratio math (pub(crate))"
---


The crate denies `arithmetic_side_effects` and precision-loss casts under clippy pedantic; every "turn two counts into a float ratio" in the codebase goes through this module to stay lint-clean and panic-free. Not public API.

**Key items**

- `trait RatioInt` — the integer families used (`u64 → f64`, `usize → f32`), with lossless narrowing types (`u32`, `u16`) and the checked/saturating operations the lint set requires.
- `unit_ratio(numerator, denominator) -> Float` — the one function everything calls.

**Behavior notes**

- Zero denominator returns `0.0` (never NaN/inf) — "empty set" semantics at every call site.
- Results are **not clamped to [0,1]** — overflow/utilization reporting legitimately produces >1.0.
- Large operands are scaled down through a lossless intermediate so precision survives (a small numerator over a huge denominator stays strictly positive; boundary values don't collapse to 1.0).
- Used by: convergence similarity, health scores, context utilization, memory relevance.

Deep dive: not user-facing — this page is the whole story.
