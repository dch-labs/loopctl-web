---
title: "src/memory/vector.rs"
---

This file holds the two traits your semantic-retrieval memory is built from, plus dependency-free reference implementations behind the `vector_index` feature (0.3.1).

Since 0.4.0 the substrate has real tiers behind it: `OllamaEmbedder` and `OpenAiEmbedder` ([embeddings](/file-reference/provider-embeddings/)), `VectorMemoryStore` ([vector_memory](/file-reference/memory-vector-memory/)), the `loopctl-hnsw` companion, and the `loopctl-vector` external backends.

## Key items

`EmbeddingProvider` takes text in and gives you an `Embedding`, which is a vector plus its dimension.

Required on you: `dim()` and `embed(&str)`.

Its provided method `embed_batch` loops `embed` and preserves your input order.

`VectorIndex` is a nearest-neighbour store keyed by `Uuid`. `add` upserts, and `search` returns the cosine-scored top-*k*.

Results sort descending with an id tiebreak, so your order is deterministic, and `remove` is idempotent. You also get `len()` and `is_empty()`.

A dimension mismatch surfaces as `LoopError::Memory`.

`LinearVectorIndex` is a brute-force O(n) cosine scan with `RwLock` interior mutability. It is deliberately simple: it is the correctness oracle any faster index must reproduce.

`HashingEmbedder` is a deterministic hash-based embedder. It uses no network and no key, and the same text yields the same vector.

Its retrieval quality is unsuitable for real use, which makes it exactly right for your tests. Zero-token input yields the documented zero vector.

`cosine_similarity` is the free helper every implementation shares.

## Behavior notes

Both traits are object-safe async, with boxed futures exactly like `LoopMemory`.

So a store can hold `Box<dyn EmbeddingProvider>` and `Box<dyn VectorIndex>` and swap backends without touching its contract.

You can run this end-to-end without any provider: the `vector-index-demo` example and the integration suite exercise the whole layer on the reference implementations.

Deep dive: [Memory](/extensions/memory/), the vector-primitives section.
