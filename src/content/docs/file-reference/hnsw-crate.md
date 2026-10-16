---
title: "crates/hnsw"
---

This companion crate gives you approximate-nearest-neighbour search for [`VectorMemoryStore`](/extensions/memory/). It is an HNSW, a Hierarchical Navigable Small World, implementation of `VectorIndex`.

It is the scale tier sitting between the linear reference index and the external stores, and it publishes after loopctl like the other companions.

## Key items

The index gives you `add`, `search`, `remove`, and `len` over the same object-safe trait the linear index implements.

Graph construction and search live in `graph.rs`, and the index mapping lives in `map.rs`.

## Behavior notes

The correctness contracts are the linear index's: cosine-scored top-k sorted descending with the id tiebreak, idempotent `remove`, and a dimension mismatch surfacing as `LoopError::Memory`.

The linear index stays the oracle that your faster indexes must match.

This crate is new in 0.4.0 and did not exist at `v0.3.2`. Reaching release resolved four contract edges: the removal model, ordering, metrics, and upsert failure handling, so search now upholds the crate's own documented behavior.

For the deep dive, see the semantic tiers section of [Memory](/extensions/memory/#the-semantic-tiers).
