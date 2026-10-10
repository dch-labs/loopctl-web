---
title: "`src/memory/search_tool.rs` — `SearchMemoriesTool`, the model-callable memory window"
---


The active half of retrieval: a read-only, concurrency-safe `Tool` the **model** calls (`search_memories`) when it decides the context is missing something — instead of relying only on the engine's passive per-turn injection.

**Key items**

- `SearchMemoriesTool::new(memory)` + `with_name` / `with_default_limit` / `with_max_result_chars` / `include_provider_derived` — the knobs clamp into the advertised bounds, so no configuration can contradict what the model is told.
- Schema: `query` + optional `limit` (missing → 5, clamped to the schema maximum 10; zero clamps *up* to one — a deliberate deviation from the crate-wide zero-disables sentinel).

**Behavior notes**

- Output is model-facing text — one `[N] (category)` line per entry, character-boundary truncation per entry (default 1,000 chars) — with the passive injection's provenance framing; `provider-derived` entries excluded unless opted in (then under the stronger untrusted header).
- Ranked, not matched: the store's nearest entries render whether or not they lexically match; an empty store answers the honest `No stored memories match "…"` line, never an empty string.
- The tool opts out of trajectory recording (`records_trajectory() -> false`) — a search tool that recorded would find its own answers next time; the engine honors the opt-out for every tool, resolving through the executed tool's name so middleware redirects can't smuggle an opted-out tool's output into the store.
- No new feature flag: plain `tool` + `memory`.

Deep dive: [Memory — the model searches too](/extensions/memory/#the-model-searches-too--searchmemoriestool)
