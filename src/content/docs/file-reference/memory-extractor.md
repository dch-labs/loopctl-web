---
title: "src/memory/extractor.rs"
---

This file turns your recorded runs into learned memories. It reads a `TrajectoryRecord`, which is the JSONL ledger `TrajectoryObserver` writes, and mines reusable lessons.

Those lessons are which strategies worked, which errors were hit and recovered, and where calls were wasted, and they are written into a `LoopMemory` store.

The default heuristic strategy is deterministic and offline, so you get no provider, no keys, and no token spend.

## Key items

`extract(path, config, client)` loads one record, and a single JSONL line qualifies, then returns the mined items without writing.

Gates run first, so runs shorter than `min_turns`, which defaults to 3, and failed runs unless you set `include_failures` mine nothing.

`extract_into(path, config, client, store)` also writes each mined item as a `MemoryEntry`, where `relevance = quality`, your tags are attached, and entries above 0.9 confidence are auto-`validated`. It returns the written count alongside the candidates.

`ExtractionStrategy` has three settings. `Heuristic` is the default and does template mining of three shapes. `Llm` has a caller-supplied `ApiClient` read a budget-capped summary and answer with a JSON array, parsed leniently.

`Hybrid` refines your heuristic candidates with the LLM, and falls back to the heuristic result with a warning if the provider fails.

What the heuristic mines is three shapes. A failed call whose tool later succeeds becomes a recovery, an `ErrorPattern` reading "retry `X` after adjusting the input".

A successful chain of at least 3 calls becomes a strategy, a `Strategy` telling you to follow this order. At least 3 calls to one tool within a single turn becomes waste, an `Insight` tagged `optimization`.

Sequential same-tool work across your turns is ordinary and unmined.

`ExtractionConfig` carries `strategy`, `max_memories` at 10 applied after sorting by quality and deduplicating identical lessons, and `min_turns` at 3.

It also carries `include_failures` at false even though failures often hold your best recovery pairs, and `llm_context_budget` at 8,000 bytes.

`ExtractionObserver` is registered alongside `TrajectoryObserver`. At `on_run_end` it reads the ledger's newest parseable line, walking back past a torn trailing line, and mines on a spawned task.

It never blocks teardown and never panics, so outside a tokio runtime it warns and skips, and extraction failures are logged and swallowed.

Telemetry covers the `memory.extract` span and `loopctl.memory.extract.attempts`, where `outcome` is `ok`, `no_client`, `parse_error`, or `api_error`. Unparseable model output is tagged and counted separately from transport failures, and a clientless `Llm` or `Hybrid` pass settles on `no_client`.

Per-category `loopctl.memory.extracted` counters carry stable `snake_case` labels.

## Behavior notes

The LLM path takes the client at the call site, so the crate pulls in no provider dependency and you choose whether extraction spends tokens at all.

Your mined memories feed the consolidation pass in the same module family. Duplicates from repeated shapes merge away, and unaccessed lessons decay out.

That is how extraction and curation compose for you.

For the deep dive, see the extraction section of [Memory](/extensions/memory/).
