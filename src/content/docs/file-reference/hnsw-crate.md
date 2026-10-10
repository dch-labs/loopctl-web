---
title: "`crates/hnsw/` — the `loopctl-hnsw` companion crate"
---


Approximate-nearest-neighbour search for [`VectorMemoryStore`](/extensions/memory/): an HNSW (Hierarchical Navigable Small World) `VectorIndex` implementation — the scale tier between the linear reference index and the external stores. Publishes after loopctl, like the other companions.

**Key items**

- The HNSW `VectorIndex` — `add`/`search`/`remove`/`len` over the same object-safe trait the linear index implements; graph construction and search in `graph.rs`, the index mapping in `map.rs`.

**Behavior notes**

- The correctness contracts are the linear index's: cosine-scored top-*k* sorted descending with the id tiebreak, idempotent `remove`, dimension-mismatch as `LoopError::Memory` — the linear index stays the oracle faster indexes must match.
- New in 0.4.0 (the crate did not exist at `v0.3.2`); reaching release resolved four contract edges (removal model, ordering, metrics, upsert failure handling) so search upholds the crate's own documented behavior.

Deep dive: [Memory — the semantic tier](/extensions/memory/#the-semantic-tier--shipped-040)
