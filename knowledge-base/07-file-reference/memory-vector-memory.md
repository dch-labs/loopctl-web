# `src/memory/vector_memory.rs` — `VectorMemoryStore`, the semantic backend [feature: vector_memory]

The semantic `LoopMemory`: entries are embedded through an `EmbeddingProvider` and stored in a `VectorIndex`; retrieval blends vector similarity with keyword + tag overlap (the shared scorer's lexical signal), consolidation prunes and merges with index eviction.

**Key items**

- `VectorMemoryStore::new(embedder, index)` — `Box<dyn EmbeddingProvider>` + `Box<dyn VectorIndex>`; swapping tiers (linear → HNSW → Qdrant/pgvector) is one constructor call.
- `VectorMemoryConfig` / `with_config` — retrieval blend and eviction knobs.
- `GoldenSet` / `GoldenQuery` / `golden_set()` / `precision_ratio(hits)` — the quality bar: a fixed query set with known-relevant entries; the ≥ 80% precision gate runs against every backend.

**Behavior notes**

- The golden set is public — a custom backend proves itself against the same bar.
- Real embedders arrive via `provider::embeddings` (`openai`/`ollama` + `vector_index`); `HashingEmbedder` covers tests.
- With `MemoryDemotionSink` + `SearchMemoriesTool` this is the store half of the evict → demote → recall loop.

Deep dive: [Memory — the semantic tier](../04-extensions/03-memory.md#the-semantic-tier--shipped-040)
