---
title: "`src/memory/entry.rs` — `MemoryEntry` and categories"
---


The record shape everything in memory is stored as.

**Key items**

- `MemoryEntry { id: Uuid, category, memory: String, tags, created_at, relevance: f32, access_count, validated, last_accessed, last_decayed }` — the two lifecycle stamps (`Option<SystemTime>`, both `#[serde(default)]`) arrived in 0.3.2: serialization is backwards-compatible, exhaustive struct literals must list them.
- `MemoryEntry::new(category, text)` — relevance 1.0, fresh UUID; builders `.with_tag(...)`, `.validated()`.
- `MemoryCategory` — `Trajectory`, `Insight`, `ErrorPattern`, `Strategy`, `Fact`, `Working`.
- `PROVIDER_DERIVED_TAG` — the `"provider-derived"` tag everything the LLM extraction pass carries; the engine excludes tagged entries from injection unless opted in.

**Behavior notes**

- `Default` differs from `new`: category `Working`, relevance 0.5 — prefer the constructor.
- `relevance` is the implementation's currency: every shipped store scores `0.5×relevance + word-match + tag bonus` (the shared `memory::score` scorer) and the consolidation pass decays/prunes around it.
- `access_count` is a popularity counter: matched retrieves stamp access, and the next consolidation fold increments it and sets `last_accessed` (which makes retrieved entries resist decay). `last_decayed` is the idempotency stamp the decay pass advances.
- `PartialEq` compares content (0.3.2) — what the file store's convergence uses to pair mirror copies with their on-disk occurrences.

Deep dive: [Memory](/extensions/memory/).
