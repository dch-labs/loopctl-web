---
title: "src/memory/search_tool.rs"
---

This file holds the active half of retrieval. It gives you `SearchMemoriesTool`, a read-only and concurrency-safe `Tool` that your model calls as `search_memories`.

Your model reaches for it when it decides your context is missing something, rather than relying only on the engine's passive per-turn injection.

## Key items

`SearchMemoriesTool::new(memory)` takes your store, and `with_name`, `with_default_limit`, `with_max_result_chars`, and `include_provider_derived` give you the rest of the knobs.

Those knobs clamp into the bounds you advertise, so no configuration of yours can contradict what your model is told.

The schema takes `query` plus an optional `limit`. A missing limit means 5, clamped to the schema maximum of 10. A zero clamps up to one, which is a deliberate deviation from the crate-wide zero-disables sentinel.

## Behavior notes

Output is model-facing text. You get one `[N] (category)` line per entry, truncated at a character boundary, which defaults to 1,000 chars.

It carries the same provenance framing as passive injection.

Your `provider-derived` entries are excluded unless you opt them in, and then they arrive under the stronger untrusted header.

Results are ranked rather than matched, so the store's nearest entries render whether or not they lexically match your query. An empty store answers with the honest `No stored memories match "…"` line and never an empty string.

The tool opts out of trajectory recording through `records_trajectory() -> false`, because a search tool that recorded would find its own answers next time.

The engine honors that opt-out for every tool, and it resolves through the executed tool's name, so middleware redirects cannot smuggle an opted-out tool's output into your store.

There is no new feature flag here, just plain `tool` plus `memory`.

For the deep dive, see [Memory: the model searches too](/extensions/memory/#the-model-searches-too).
