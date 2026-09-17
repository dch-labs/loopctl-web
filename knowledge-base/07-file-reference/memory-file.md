# `src/memory/file.rs` — `FileMemoryStore` [feature: file_memory]

The JSONL-backed `LoopMemory`: an in-memory mirror with one compact-JSON `MemoryEntry` appended per line, so an agent's learned memory survives a process restart. The feature adds zero dependencies.

**Key items**

- `FileMemoryStore::open(path)` — load an existing file (a missing one is created without truncating, so concurrent opens cannot discard a writer's lines) and share state with every live handle on that path; `new(path)` starts fresh without reading.
- `store` — a single O(1) append: the line and its terminator in one write, so concurrent appenders through any handle can never weld a line. A non-finite `relevance` is refused before anything is written — serialized, it would be a `null` the loader treats as fatal mid-file corruption.
- `retrieve` — ranks through the shared `score_entry` scorer, so results, ordering, and tie-breaking are identical to `InMemoryStore`. A query that actually matched stamps the entry's access (folded in by the next consolidation); baseline-only returns are never stamped.
- `consolidate` / `flush` — rewrite the whole file atomically and durably: an exclusively-created, unpredictably-named temp file (a planted symlink at a predictable temp name cannot redirect the rewrite) renamed over the target, with the containing directory synced so the rename survives power loss. `consolidate` runs the shared consolidation pass first; `with_consolidation(config)` tunes it.
- `fail_next_rewrite_at(path, stage)` + `RewriteFaultStage` [feature: testing] — deterministic fault injection for the rewrite path, for hosts pinning crash behavior on runners where permission bits cannot force a failure.

**Behavior notes**

- `open` repairs a torn final line (a crash mid-append) and drops its fragment with a warning, so a later append cannot weld onto it; a malformed complete line anywhere earlier fails the open — corruption is loud, not silent.
- A failed append latches the store unusable — every handle converging on the path refuses further writes — until a fresh `open` repairs the tail. A failed rewrite never removes bytes; a durability-unconfirmed rewrite (the rename landed, the directory sync did not) still commits.
- Handles on one path within one process share state, spellings that resolve to one file unify into a single store; cross-process access is unsupported by contract — no file locking, two processes will corrupt the file. For multi-process durability use the `loopctl-sqlite` companion.

Deep dive: [Memory](../04-extensions/03-memory.md) — the persistent-backends section.
