---
title: "src/memory/vector_memory.rs"
---

This file is your semantic `LoopMemory`, under the `vector_memory` feature. Entries are embedded through an `EmbeddingProvider` and stored in a `VectorIndex`.

Retrieval blends vector similarity with keyword and tag overlap, which is the shared scorer's lexical signal, and consolidation prunes and merges with index eviction.

## Key items

`VectorMemoryStore::new(embedder, index)` takes a `Box<dyn EmbeddingProvider>` plus a `Box<dyn VectorIndex>`, so swapping tiers from linear to HNSW to Qdrant or pgvector costs you one constructor call.

`VectorMemoryConfig` and `with_config` expose your retrieval blend and eviction knobs.

`GoldenSet`, `GoldenQuery`, `golden_set()`, and `precision_ratio(hits)` carry your quality bar: a fixed query set with known-relevant entries, where the 80% precision gate runs against every backend.

## Behavior notes

The golden set is public, so your custom backend proves itself against the same bar.

Real embedders arrive through `provider::embeddings` with `openai` or `ollama` plus `vector_index`, and `HashingEmbedder` covers your tests.

Pair `MemoryDemotionSink` with `SearchMemoriesTool` and this becomes the store half of the evict, demote, recall loop.

Deep dive: [Memory: the semantic tiers](/extensions/memory/#the-semantic-tiers)
