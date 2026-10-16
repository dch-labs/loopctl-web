---
title: "crates/sqlite"
---

This companion crate gives you durable, indexed, concurrent memory. `SqliteMemoryStore` implements loopctl's `LoopMemory` trait over a local SQLite database, using `rusqlite` with the `bundled` feature so you need no system SQLite.

It predates 0.4.0 as a `0.3.2` companion and moved under `crates/` with the other companions in 0.4.0.

You add it as a direct dependency, so no `loopctl` feature is required, and it publishes after loopctl like the other companions.

## Key items

`SqliteMemoryStore` gives you `open(path)`, which creates the schema if absent, and `in_memory()` for your tests, plus `with_consolidation(config)` to tune the shared consolidation pass.

It implements `LoopMemory` through `store`, `retrieve`, `consolidate`, and `flush`.

The schema in `schema.rs` is a `memory_entries` core table with indexes on `relevance` and `category`, plus an `access_stamps` table.

There is also an FTS5 virtual table, `memory_fts`, with `tokenize='porter unicode61'`, and it is maintained on every write you make.

## Behavior notes

Retrieval loads every entry and ranks it in Rust with loopctl's shared `score_entry` scorer. So the same entries match, in the same order with the same tie-breaking, as the in-memory and file backends.

The FTS5 index is maintained for out-of-band querying, but your retrieval deliberately never consults it, because ranking every entry is what guarantees the parity contract.

Durability is transactional. WAL journaling gives you concurrent readers with a single writer, and a committed write survives a process crash.

With `synchronous = NORMAL`, though, WAL may lose the most recent commits to power loss. That is the same process-crash versus power-loss distinction [the file backend](/file-reference/memory-file/) draws between its appends and its synced rewrites.

This is the multi-process answer to the JSONL file store. Your file memory is explicitly single-process by contract, with no locking, so two writers corrupt the file, whereas SQLite's own locking makes concurrent access safe here.

Failures surface as the crate's `SqliteMemoryError`.

For the deep dive, see the persistent-backends section of [Memory](/extensions/memory/).
