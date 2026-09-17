---
title: "`src/memory/consolidate.rs` — consolidation primitives"
---


The building blocks every `LoopMemory` backend composes to make `consolidate` real: a composite quality score, category-weighted time decay, near-duplicate clustering with corroboration merges, and the one-call pass tying them together. The built-in store uses them under its write lock; the file store and the `loopctl-sqlite` companion (both 0.3.2) reuse the same primitives.

**Key items**

- `quality_score(entry, now)` — relevance ×0.45 + log-scaled access ×0.30 + recency ×0.15 + validated ×0.10, all normalized so the score stays in `0.0..=1.0`. Relevance dominates; the log scale makes the first few retrievals count far more than the fiftieth.
- `decay_relevance(entry, now, half_life)` — multiplies relevance by `0.5 ^ elapsed_half_lives`. **Idempotent over cadence**: each pass advances a `last_decayed` stamp on the entry, so consolidating hourly, daily, or once per age produces the same relevance. The baseline is the later of the last decay pass and the last access — a recently retrieved memory resists decay.
- `category_decay_weight(category)` — `Fact`/`Strategy` decay at half rate (durable), `Insight`/`ErrorPattern` at 0.75, `Trajectory` neutral, `Working` at double (ephemeral).
- `cluster_duplicates(entries, threshold)` — greedy Jaccard clustering (lowercased, punctuation-trimmed tokens) within one category; the canonical is the highest-quality member.
- `merge_cluster(cluster)` — keeps the canonical's `id` and text; unions tags, sums access counts, any member's `validated` wins, relevance rises by 0.1 per duplicate (capped at 1.0), provenance keeps the earliest `created_at` and the freshest `last_accessed`.
- `consolidate_entries(entries, config, now)` — the full pass: decay → promote best canonical → merge → prune (entries below the floor by *post-decay relevance or* composite quality) → stats. Pruning by relevance alone preserves the historical contract — a fresh low-relevance entry is dropped on the first pass however new it is; the quality floor is what ages out stale, hollowed-out knowledge.
- `ConsolidationConfig` — `decay` (on), `half_life` (14 days), `merge` (on), `merge_threshold` (0.6), `prune_floor` (0.05, matching the store's historical floor).

**Behavior notes**

- Pure functions over a `&mut Vec` — no locks; a store runs the pass under its own write guard.
- The `MemoryEntry` fields the pass maintains — `last_accessed` (set by the store's access log) and `last_decayed` (advanced by decay) — are additive and serde-backwards-compatible.

Deep dive: [Memory](/extensions/memory/) — the consolidation section.
