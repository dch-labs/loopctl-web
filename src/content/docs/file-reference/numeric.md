---
title: "src/numeric.rs"
---

This file is internal safe ratio math, marked `pub(crate)`. Your crate denies `arithmetic_side_effects` and precision-loss casts under clippy pedantic.

So when you turn two counts into a float ratio, you do it through this module to stay lint-clean and panic-free. It is not public API.

## Key items

`trait RatioInt` covers the integer families you use, `u64 → f64` and `usize → f32`.

It also carries lossless narrowing types such as `u32` and `u16`, plus the checked and saturating operations the lint set requires.

`unit_ratio(numerator, denominator) -> Float` is the one function everything calls.

## Behavior notes

A zero denominator returns `0.0`, never NaN/inf, which matches the empty-set reading at every call site you make.

Your results are not clamped to [0,1], because overflow and utilization reporting legitimately produces values above 1.0.

Large operands are scaled down through a lossless intermediate so precision survives, which you want. A small numerator over a huge denominator stays strictly positive, and boundary values do not collapse to 1.0.

Your callers include convergence similarity, health scores, context utilization, and memory relevance.

Deep dive: not user-facing, so this page is the whole story.
