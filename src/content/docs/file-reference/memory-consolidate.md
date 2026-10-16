---
title: "src/memory/consolidate.rs"
---

This file holds the building blocks that every `LoopMemory` backend composes to make `consolidate` real. You get a composite quality score, category-weighted time decay, near-duplicate clustering with corroboration merges, and the one-call pass that ties them together.

The built-in store uses them under its write lock, and the file store plus the `loopctl-sqlite` companion, both from 0.3.2, reuse the same primitives.

## Key items

`quality_score(entry, now)` computes relevance times 0.45, plus log-scaled access times 0.30, plus recency times 0.15, plus validated times 0.10. All terms are normalized so the score stays in `0.0..=1.0`.

Relevance dominates, and the log scale makes your first few retrievals count far more than the fiftieth.

`decay_relevance(entry, now, half_life)` multiplies relevance by `0.5 ^ elapsed_half_lives`. It is idempotent over cadence, because each pass advances a `last_decayed` stamp on your entry, so consolidating hourly, daily, or once per age produces the same relevance.

The baseline is the later of the last decay pass and the last access, so a recently retrieved memory resists decay.

`category_decay_weight(category)` sets the rate per category. `Fact` and `Strategy` decay at half rate because they are durable, `Insight` and `ErrorPattern` at 0.75, `Trajectory` is neutral, and `Working` runs at double because it is ephemeral.

`cluster_duplicates(entries, threshold)` runs greedy Jaccard clustering over your lowercased, punctuation-trimmed tokens within one category.

You can read the cluster as your near-duplicate set, whose canonical is the highest-quality member.

`merge_cluster(cluster)` keeps the canonical's `id` and text. It unions tags, sums access counts, lets any member's `validated` win, and raises relevance by 0.1 per duplicate, capped at 1.0.

Provenance keeps the earliest `created_at` you have and the freshest `last_accessed` you have.

`consolidate_entries(entries, config, now)` runs the full pass: decay, then promote the best canonical, then merge, then prune, then stats. Pruning looks at post-decay relevance or composite quality against the floor.

Pruning by relevance alone preserves the historical contract, so a fresh low-relevance entry is dropped on the first pass however new it is. The quality floor is what ages out your stale, hollowed-out knowledge.

`ConsolidationConfig` exposes `decay` on by default, `half_life` at 14 days, `merge` on, `merge_threshold` at 0.6, and `prune_floor` at 0.05, which matches the store's historical floor.

## Behavior notes

These are pure functions over a `&mut Vec`, with no locks, so your store runs the pass under its own write guard.

The `MemoryEntry` fields the pass maintains are `last_accessed`, which your store's access log sets, and `last_decayed`, which decay advances. Both are additive and serde-backwards-compatible, so your saved entries still load.

For the deep dive, see the consolidation section of [Memory](/extensions/memory/).
