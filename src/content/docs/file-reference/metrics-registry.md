---
title: "src/metrics/registry.rs"
---

This file is the metric catalog: one auditable table declaring every metric name under the telemetry contract, its kind, and its closed label set. Behind the `metrics` feature.

## Key items

`REGISTRY` holds 65 `MetricDescriptor` rows. Shorthand constructors `c`, `g`, and `h` build counter, gauge, and histogram rows so the table reads one entry per line.

`all()` iterates the table for you, `lookup(name)` finds a descriptor by exact name, and `validate(name, label_keys)` checks an observed emission against its declaration.

## Behavior notes

Names follow `loopctl.<subsystem>.<name>[.<unit>]`, are unique, and histogram names carry a unit suffix modulo seven legacy rows.

Validation demands the exact declared label set, order-insensitive, with duplicates refused. When you emit a subset or a superset, the call refuses and you count the gap.

Two pins guard the table itself: one asserts the grammar and uniqueness, another asserts histogram unit suffixes. `tests/registry_emission_audit.rs` separately fails the build when a declared row you rely on has no emission site.

For the deep dive, see [Run metrics](/telemetry/metrics/).
