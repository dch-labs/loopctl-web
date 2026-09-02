---
title: "`src/memory/entry.rs` — `MemoryEntry` and categories"
---


The record shape everything in memory is stored as.

**Key items**

- `MemoryEntry { id: Uuid, category, memory: String, tags, created_at, relevance: f32, access_count, validated }`.
- `MemoryEntry::new(category, text)` — relevance 1.0, fresh UUID; builders `.with_tag(...)`, `.validated()`.
- `MemoryCategory` — `Trajectory`, `Insight`, `ErrorPattern`, `Strategy`, `Fact`, `Working`.

**Behavior notes**

- `Default` differs from `new`: category `Working`, relevance 0.5 — prefer the constructor.
- `relevance` is the implementation's currency: the built-in store scores `0.5×relevance + word-match + tag bonus` and prunes below 0.05 on consolidate.
- `access_count` is a popularity counter the built-in store never increments — your store may.

Deep dive: [Memory](/extensions/memory/).
