# `crates/vector/` — the `loopctl-vector` crate

Semantic memory past one process: the external vector-store backends — `QdrantIndex` (the dedicated vector DB, self-hosted or cloud: memory shared across sessions and hosts) and `PgVectorIndex` (one `vector(n)` table + HNSW index in the Postgres a team already runs: zero new infrastructure). Two opt-in features (`qdrant`, `pgvector`); an **excluded side-workspace** with its own dependency graph and lockfile, so the root workspace's builds never resolve it.

**Key items**

- Both implement `VectorIndex` behind their own feature — `VectorMemoryStore::new(embedder, Box::new(index))` swaps tiers with one constructor call; same hybrid retrieval, same `LoopMemory` contract, same golden-set ≥ 80% precision gate against every backend.
- Auto-provisioning at construction (collection / `CREATE TABLE IF NOT EXISTS` + `vector_cosine_ops` HNSW — idempotent under concurrent construction; pgvector self-loads the `vector` extension), blank-name and zero-dimension validation up front, and **connect-time shape validation** — a dimension-mismatched reuse, a foreign table, a named-vector or quantized or multivector collection, a non-cosine metric rejects at connect instead of mis-scoring on use.
- `QdrantIndex::builder(url, collection, dim).connect()` / `from_env` (`QDRANT_URL`/`QDRANT_COLLECTION`/`QDRANT_API_KEY`); `PgVectorIndexBuilder::new(url, table, dim)` (`PG_VECTOR_URL`/`PG_VECTOR_TABLE`).

**Behavior notes**

- Degenerate vectors (non-finite, zero-norm — what `HashingEmbedder` over empty text produces) reject at `add` and `search` with a named `LoopError::Memory`; a `k` of `0` returns empty. The in-process tiers keep their documented `0.0`-similarity fallback — the external tiers fail loudly instead of diverging silently.
- pgvector searches run inside one transaction sizing `hnsw.ef_search` to `k` (transaction-local, so pooled connections never leak the setting) — a `k` above pgvector's 40-candidate default no longer silently caps at 40; above the server ceiling of 1000 it rejects naming the ceiling.
- Sync `len` answers from construction-seeded client-side bookkeeping (`RemoteCount`): exact while this process is the only writer; cross-process writes are invisible until a fresh construction, by design.
- A qdrant collection deleted mid-life re-provisions once on the next failing operation and retries itself.
- CI: the service-less `vector-check` gate rides `make ci`; the live suites (`qdrant` + `pgvector/pgvector` containers) run behind `LOOPCTL_VECTOR_E2E=1`.

Deep dive: [Memory — the semantic tier](../04-extensions/03-memory.md#the-semantic-tier--shipped-040)
