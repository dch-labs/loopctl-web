---
title: "`src/memory/builtin.rs` — `InMemoryStore`"
---


The reference `LoopMemory` implementation: a `Vec` behind a read-write lock. For tests, prototypes, small agents — not production (see `memory/file.rs` and the `loopctl-sqlite` companion for persistence).

**Key items**

- `InMemoryStore::new()` / `with_entries(vec)` — seeding for fixtures.
- `store` — append; never errors; **no capacity limit, no eviction**.
- `retrieve` — score = `0.5×relevance + 0.4×(query-word match fraction) + 0.3×(tag contains query) + 0.1` baseline (the shared `memory::score::score_entry`, so every backend ranks identically); case-insensitive substring matching; sorted by score, takes the limit. Snapshot under the lock, score outside (writers never blocked — pinned by test). Matched retrieves record an access stamp; the next consolidation folds it into `access_count`/`last_accessed`.
- `consolidate` — a full pass over the store: category-weighted decay (14-day half-life), near-duplicate merging (Jaccard ≥ 0.6), quality-floor pruning, the access-stamp fold, and real `merged`/`bytes_saved` stats. Tune with `with_consolidation(config)`.

**Behavior notes**

- Grows between consolidation passes; the engine consolidates after successful runs. The pass decays stale knowledge and merges duplicates, so a periodically consolidated store stops accreting — but an entry nobody retrieves and nothing refreshes still fades out over weeks. That is the design, not a leak.
- The scoring is transparent word overlap — not semantic. Short common queries ("tool") match broadly.
- Lock poisoning is recovered (single-operation data), never propagated.

Deep dive: [Memory](/extensions/memory/).
