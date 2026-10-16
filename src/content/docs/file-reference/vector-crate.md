---
title: "crates/vector"
---

This crate gives you semantic memory past one process. It holds the external vector-store backends.

`QdrantIndex` targets the dedicated vector DB, self-hosted or cloud, so your memory is shared across your sessions and hosts.

`PgVectorIndex` targets one `vector(n)` table plus an HNSW index in the Postgres your team already runs, which costs you zero new infrastructure.

These are two opt-in features, `qdrant` and `pgvector`. The crate is an excluded side-workspace with its own dependency graph and lockfile, so your root workspace's builds never resolve it.

## Key items

Both types implement `VectorIndex` behind their own feature, so `VectorMemoryStore::new(embedder, Box::new(index))` swaps your tier with one constructor call.

You keep the same hybrid retrieval and the same `LoopMemory` contract, and the same golden-set gate of at least 80% precision runs against every backend.

Auto-provisioning happens at construction. You get your collection, or `CREATE TABLE IF NOT EXISTS` plus a `vector_cosine_ops` HNSW index.

That is idempotent under concurrent construction, and pgvector self-loads the `vector` extension.

Blank-name and zero-dimension validation run up front, and connect-time shape validation follows. A dimension-mismatched reuse, a foreign table, a named-vector, quantized, or multivector collection, and a non-cosine metric all reject at connect instead of mis-scoring on use.

`QdrantIndex::builder(url, collection, dim).connect()` builds one, and `from_env` reads `QDRANT_URL`, `QDRANT_COLLECTION`, and `QDRANT_API_KEY`. For Postgres you use `PgVectorIndexBuilder::new(url, table, dim)`, which reads `PG_VECTOR_URL` and `PG_VECTOR_TABLE`.

## Behavior notes

Degenerate vectors are non-finite or zero-norm, which is what `HashingEmbedder` over empty text produces. They reject at `add` and `search` with a named `LoopError::Memory`, and a `k` of `0` returns empty.

The in-process tiers keep their documented `0.0`-similarity fallback, and the external tiers fail loudly instead of diverging silently on you.

A pgvector search runs inside one transaction that sizes `hnsw.ef_search` to your `k`. That is transaction-local, so a pooled connection never leaks the setting.

A `k` above pgvector's 40-candidate default no longer silently caps at 40. Above the server ceiling of 1000 it rejects and names the ceiling to you.

A sync `len` answers from construction-seeded client-side bookkeeping called `RemoteCount`. The count is exact while your process is the only writer, and cross-process writes stay invisible until you construct again, by design.

A qdrant collection that you delete mid-life re-provisions once on the next failing operation and retries itself.

On CI, the service-less `vector-check` gate rides `make ci`, and the live suites, which use `qdrant` and `pgvector/pgvector` containers, run behind `LOOPCTL_VECTOR_E2E=1`.

For the deep dive, see [Memory: the semantic tiers](/extensions/memory/#the-semantic-tiers).
