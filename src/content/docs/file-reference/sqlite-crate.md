---
title: "`crates/sqlite/` — the `loopctl-sqlite` companion crate"
---


Durable, indexed, concurrent memory: `SqliteMemoryStore` implements loopctl's `LoopMemory` trait over a local SQLite database (`rusqlite` with the `bundled` feature — no system SQLite required). It predates 0.4.0 (a `0.3.2` companion) and moved under `crates/` with the other companions in 0.4.0; it is added as a direct dependency, so no `loopctl` feature is required. Publishes after loopctl, like the other companions.

**Key items**

- `SqliteMemoryStore` — `open(path)` (creates the schema if absent), `in_memory()` for tests, and `with_consolidation(config)` to tune the shared consolidation pass; implements `LoopMemory` (`store`/`retrieve`/`consolidate`/`flush`).
- Schema (`schema.rs`) — a `memory_entries` core table with indexes on `relevance` and `category`, an `access_stamps` table, and an FTS5 virtual table (`memory_fts`, `tokenize='porter unicode61'`) maintained on every write.

**Behavior notes**

- Retrieval loads every entry and ranks it in Rust with loopctl's shared `score_entry` scorer — so the same entries match, in the same order with the same tie-breaking, as the in-memory and file backends. The FTS5 index is maintained for out-of-band querying but retrieval deliberately never consults it: ranking every entry is what guarantees the parity contract.
- Durability is transactional. WAL journaling gives concurrent readers with a single writer; a committed write survives a process crash. But with `synchronous = NORMAL`, WAL may lose the most recent commits to *power loss* — the same process-crash vs power-loss distinction [the file backend](/file-reference/memory-file/) draws between its appends and its synced rewrites.
- This is the multi-process answer to the JSONL file store: file memory is explicitly single-process by contract (no locking; two writers corrupt the file), whereas SQLite's own locking makes concurrent access safe here.
- Failures surface as the crate's `SqliteMemoryError`.

Deep dive: [Memory](/extensions/memory/) — the persistent-backends section.
