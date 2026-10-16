---
title: "src/memory/builtin.rs"
---

This file is your reference `LoopMemory` implementation: a `Vec` behind a read-write lock. Use it for tests, prototypes, and small agents, not production.

Reach for `memory/file.rs` or the `loopctl-sqlite` companion when you need persistence.

## Key items

`InMemoryStore::new()` starts empty, and `with_entries(vec)` seeds fixtures for you.

`store` appends, never errors, and imposes no capacity limit and no eviction.

`retrieve` scores each entry with `0.5×relevance + 0.4×(query-word match fraction) + 0.3×(tag contains query) + 0.1` through the shared `memory::score::score_entry`, so every backend ranks identically.

Matching is a case-insensitive substring test, results sort by score, and the limit trims. Your snapshot happens under the lock while scoring happens outside it, so writers are never blocked, and a test pins that.

Matched retrieves record an access stamp, and the next consolidation folds it into `access_count` and `last_accessed`.

`consolidate` runs a full pass: category-weighted decay with a 14-day half-life, near-duplicate merging at Jaccard ≥ 0.6, quality-floor pruning, the access-stamp fold, and real `merged` and `bytes_saved` stats. Tune it with `with_consolidation(config)`.

## Behavior notes

Your store grows between consolidation passes, and your engine consolidates after successful runs. The pass decays stale knowledge and merges duplicates, so a periodically consolidated store stops accreting.

An entry nobody retrieves and nothing refreshes still fades out over weeks. That is the design, not a leak.

Scoring is transparent word overlap, not semantic, so short common queries like "tool" match broadly.

Lock poisoning is recovered, since this is single-operation data, and never propagated.

Deep dive: [Memory](/extensions/memory/).
