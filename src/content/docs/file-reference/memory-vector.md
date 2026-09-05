---
title: "`src/memory/vector.rs` — embedding and vector-search primitives"
---


The two traits semantic-retrieval memory is built from, plus dependency-free reference implementations — behind the `vector_index` feature (0.3.1). No dependencies added, no defaults changed: this is substrate for the semantic-memory releases, not a working memory system on its own.

**Key items**

- `EmbeddingProvider` — text in, `Embedding` (vector + dimension) out. Required: `dim()` and `embed(&str)`. Provided: `embed_batch` loops `embed` and preserves input order.
- `VectorIndex` — a nearest-neighbour store keyed by `Uuid`. `add` upserts; `search` returns the cosine-scored top-*k*, sorted descending with an id tiebreak (deterministic order); `remove` is idempotent; `len()` / `is_empty()`. A dimension mismatch surfaces as `LoopError::Memory`.
- `LinearVectorIndex` — brute-force O(n) cosine scan with `RwLock` interior mutability. Deliberately simple: the correctness oracle any faster index must reproduce.
- `HashingEmbedder` — deterministic hash-based embedder. No network, no key, same text → same vector; retrieval quality unsuitable for real use, exactly right for tests. Zero-token input yields the documented zero vector.
- `cosine_similarity` — the free helper every implementation shares.

**Behavior notes**

- Both traits are **object-safe async** — boxed futures exactly like `LoopMemory` — so a store can hold `Box<dyn EmbeddingProvider>` / `Box<dyn VectorIndex>` and swap backends without touching its contract.
- Runnable end-to-end without any provider: the `vector-index-demo` example and the integration suite exercise the whole layer on the reference implementations.

Deep dive: [Memory](/extensions/memory/) — the vector-primitives section.
