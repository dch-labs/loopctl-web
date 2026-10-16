---
title: "src/memory/file.rs"
---

This file gives you the JSONL-backed `LoopMemory`, behind the `file_memory` feature. It is an in-memory mirror with one compact-JSON `MemoryEntry` appended per line, so your agent's learned memory survives a process restart.

The feature adds zero dependencies.

## Key items

`FileMemoryStore::open(path)` loads an existing file, and a missing one is created without truncating, so concurrent opens cannot discard another writer's lines. Handles you open on that path share state, and `new(path)` starts fresh without reading.

`store` is a single O(1) append, meaning the line and its terminator in one write, so concurrent appenders through any of your handles can never weld a line.

A non-finite `relevance` is refused before anything is written. Serialized, it would be a `null` that the loader treats as fatal mid-file corruption.

`retrieve` ranks through the shared `score_entry` scorer, so your results, ordering, and tie-breaking are identical to `InMemoryStore`.

A query that actually matched stamps the entry's access, which the next consolidation folds in, and baseline-only returns are never stamped.

`consolidate` and `flush` rewrite your whole file atomically and durably. They write an exclusively-created, unpredictably-named temp file, so a planted symlink at a predictable temp name cannot redirect the rewrite, and then rename over the target.

The containing directory is synced too, so the rename survives power loss. `consolidate` runs the shared consolidation pass first, and `with_consolidation(config)` tunes it.

`fail_next_rewrite_at(path, stage)` plus `RewriteFaultStage` give you deterministic fault injection for the rewrite path under the `testing` feature, which you need on runners where permission bits cannot force a failure.

## Behavior notes

`open` repairs a torn final line from a crash mid-append and drops its fragment with a warning, so a later append cannot weld onto it.

A malformed complete line anywhere earlier fails your open, because corruption is loud rather than silent.

A failed append latches the store unusable, and every handle converging on that path refuses further writes until you `open` again and repair the tail.

A failed rewrite never removes bytes, and a durability-unconfirmed rewrite, where the rename landed but the directory sync did not, still commits.

Handles on one path within one process share state, and spellings that resolve to one file unify into a single store. Cross-process access is unsupported by contract, since there is no file locking and two processes will corrupt your file. For multi-process durability, use the `loopctl-sqlite` companion.

For the deep dive, see the persistent-backends section of [Memory](/extensions/memory/).
