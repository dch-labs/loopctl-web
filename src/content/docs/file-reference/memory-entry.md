---
title: "src/memory/entry.rs"
---

This file is the record shape everything in your memory is stored as.

## Key items

`MemoryEntry { id: Uuid, category, memory: String, tags, created_at, relevance: f32, access_count, validated, last_accessed, last_decayed }` is the record.

The two lifecycle stamps arrived in 0.3.2 as `Option<SystemTime>`, both `#[serde(default)]`, so serialization stays backwards-compatible while exhaustive struct literals must list them.

`MemoryEntry::new(category, text)` gives you relevance 1.0 and a fresh UUID, then you chain `.with_tag(...)` and `.validated()`.

`MemoryCategory` covers `Trajectory`, `Insight`, `ErrorPattern`, `Strategy`, `Fact`, and `Working`.

`PROVIDER_DERIVED_TAG` is the `"provider-derived"` tag that everything the LLM extraction pass carries, and your engine excludes tagged entries from injection unless you opt them in.

## Behavior notes

`Default` differs from `new`: category `Working` and relevance 0.5, so prefer the constructor.

`relevance` is the implementation's currency. Every shipped store scores with `0.5×relevance + word-match + tag bonus` through the shared `memory::score` scorer.

Your consolidation pass decays and prunes around that number.

`access_count` is your popularity counter. Matched retrieves stamp access, and the next consolidation fold increments it and sets `last_accessed`, which makes retrieved entries resist decay.

`last_decayed` is the idempotency stamp your decay pass advances.

`PartialEq` compares content since 0.3.2, which is what your file store's convergence uses to pair mirror copies with their on-disk occurrences.

Deep dive: [Memory](/extensions/memory/).
