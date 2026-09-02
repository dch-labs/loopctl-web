---
title: "`src/memory/builtin.rs` — `InMemoryStore`"
---


The reference `LoopMemory` implementation: a `Vec` behind a read-write lock. For tests, prototypes, small agents — not production (no persistence).

**Key items**

- `InMemoryStore::new()` / `with_entries(vec)` — seeding for fixtures.
- `store` — append; never errors; **no capacity limit, no eviction**.
- `retrieve` — score = `0.5×relevance + 0.4×(query-word match fraction) + 0.3×(tag contains query) + 0.1` baseline; case-insensitive substring matching; sorted by score, takes the limit. Snapshot under the lock, score outside (writers never blocked — pinned by test).
- `consolidate` — prune `relevance < 0.05`; merges nothing; reports pruned counts.

**Behavior notes**

- Unbounded growth unless you consolidate (the engine does after successful runs).
- The scoring is transparent word overlap — not semantic. Short common queries ("tool") match broadly.
- Lock poisoning is recovered (single-operation data), never propagated.

Deep dive: [Memory](/extensions/memory/).
