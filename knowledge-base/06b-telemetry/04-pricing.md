# Prices and cost

A price table is the missing half of every cost display. loopctl vendors one, dates it, and does the math in micro-dollars over the usage a run already reports. The `pricing` module is always compiled, needs no feature flag, and adds no dependency. Source: `src/pricing.rs` and `src/pricing/curated_prices.json`.

Added in 0.5.0.

## The vendored table

`curated_prices.json` carries `table_version`, a `pricing_updated` date, and per-family rates: `input`, `output`, and optional `cache_read` and `cache_write`, all in USD per million tokens.

The seed came from converting OpenRouter's public models listing on the table's own date. That gave 1,022 rows over 336 canonical models and 53 providers, so the out-of-box table prices what people actually run. The current vintage reads 2026-11-02.

Load it once and read from the static:

```rust
use loopctl::pricing::PriceTable;

let table = PriceTable::curated();
let price = table.price("claude-opus-5.5").expect("priced family");
println!("input {} micro-USD per M tokens", price.input_micro_per_mtok);
```

Every rate is micro-dollars per million tokens. `cache_read_micro_per_mtok` and `cache_write_micro_per_mtok` are `Option`, and a family that publishes no cache column prices its cached traffic at the base input rate. Lookup is prefix-based and case-insensitive, so a dated snapshot id inherits its family's row.

The same table answers a staleness question. `days_stale(as_of)` counts days since `pricing_updated`, and `is_stale(as_of)` compares against `STALE_AFTER_DAYS = 90`. A CI job or a startup check can refuse to run on a table nobody refreshed.

## Cost over usage

`cost(model, usage)` prices one usage record through the table and returns a `CostBreakdown`, or `None` for a model the table does not price.

```rust
let cost = table.cost("claude-opus-5.5", usage).expect("priced");
println!("${:.6}", cost.total_usd_micro as f64 / 1_000_000.0);
```

The breakdown carries one field per class: `input_usd_micro`, `output_usd_micro`, `cache_read_usd_micro`, `cache_write_usd_micro`, and the saturating `total_usd_micro`. It also carries its stamps, `model`, `table_version`, and `pricing_updated`, so a historical rollup groups last month's spend under last month's prices.

`None` is the honest answer, never a guessed zero. Cost math runs in micro-dollar integers, and the `micro_usd` helper converts dollars the other way.

## The budget line

The [budget gate](../03-safety/10-budget-gate.md) gained a fourth dimension, `Usd`. A turn's usage is priced through the gate's price table at capture, so a `budgets.cost_usd` line in your manifest now spends real money rather than mapping to nothing.

Two rules keep it honest. A provider that reports no usage spends nothing on the line. A model the table does not price spends nothing on the line. The hard ceiling compares in micro-dollars, and the refusal carries the numbers.

## Refreshing the table

The refresh is a conversion, not hand-maintenance. Pull the listing and convert it offline:

```sh
curl -s https://openrouter.ai/api/v1/models \
  | cargo run --example import_openrouter_prices -- --date 2026-11-02 \
  > src/pricing/curated_prices.json
```

The conversion is deterministic: `PriceTable::from_openrouter(listing, date)` scales per-token prices to per-million once, keeps every model under its bare id and its `vendor/model` spelling, gives dotted spellings their dashed aliases, and skips `:free` and `:batch` variants plus `~` aliases as different products. `to_json()` renders the interchange format back.

Run the same tool with `--check <existing.json>` and it becomes a drift probe. Exit `0` means no drift. Exit `3` means a family or price moved, and the fresh table lands on stdout ready to replace the file. Exit `1` is a failure, fences included: a conversion that lands zero priced families, or would drop more than half the rows the checked table carries, refuses to publish.

A nightly workflow runs the probe and opens a pull request on drift, so the vendored table cannot rot silently. Review the diff like code, because the table is pinned, dated data.

## Overrides

`PriceTable::load_overrides_dir(path)` reads your own overlay files, and `with_overrides` layers them over the curated base. Your private gateway rates win without editing the vendored file. `same_prices` compares two tables by price rows alone, ignoring vintage.

## Related pages

- [The budget gate](../03-safety/10-budget-gate.md): the line that spends this table.
- [Messages](../01-core-data/01-messages.md): the usage classes the math reads.
- [File reference: pricing.rs](../07-file-reference/pricing.md)
