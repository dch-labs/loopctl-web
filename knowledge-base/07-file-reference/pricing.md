# `src/pricing.rs`

This file is the cost plane's source of truth: a vendored, dated price table and micro-dollar cost math over the usage a run already reports. Always compiled, no feature flag, no dependency.

## Key items

`PriceTable::curated()` parses the vendored `src/pricing/curated_prices.json` once and answers from a static. `from_json`, `from_file`, `from_openrouter`, and `to_json` round-trip the interchange format. `load_overrides_dir` and `with_overrides` layer your own rates over the base.

`ModelPrice` holds `input_micro_per_mtok`, `output_micro_per_mtok`, and optional `cache_read_micro_per_mtok` and `cache_write_micro_per_mtok`, all micro-dollars per million tokens.

`cost(model, usage)` prices one usage report into a `CostBreakdown` with per-class fields and a saturating `total_usd_micro`, or returns `None` for an unpriced model.

`days_stale` and `is_stale` compare the table's `pricing_updated` date against `STALE_AFTER_DAYS = 90`.

## Behavior notes

Lookup is prefix-based and case-insensitive, so a dated snapshot id inherits its family's row.

A family with no cache column prices cached traffic at the base input rate, never a zero.

The `import_openrouter_prices` example is the refresh tool, and `--check` turns it into a drift probe with a fence against a broken listing.

For the deep dive, see [Prices and cost](../06b-telemetry/04-pricing.md).
