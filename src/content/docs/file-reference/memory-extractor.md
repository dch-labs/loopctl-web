---
title: "`src/memory/extractor.rs` — trajectory-to-memory extraction"
---


Turns recorded runs into learned memories: reads a `TrajectoryRecord` (the JSONL ledger `TrajectoryObserver` writes) and mines reusable lessons — which strategies worked, which errors were hit and recovered, where calls were wasted — then writes them into a `LoopMemory` store. The default heuristic strategy is deterministic and offline: no provider, no keys, no token spend.

**Key items**

- `extract(path, config, client)` — loads one record (a single JSONL line qualifies) and returns the mined items without writing. Applies the gates first: runs shorter than `min_turns` (default 3) and failed runs (unless `include_failures`) mine nothing.
- `extract_into(path, config, client, store)` — also writes each mined item as a `MemoryEntry` (`relevance = quality`, tags attached, auto-`validated` above 0.9 confidence). Returns the written count alongside the candidates.
- `ExtractionStrategy` — `Heuristic` (default): template mining of three shapes. `Llm`: a caller-supplied `ApiClient` reads a budget-capped summary and answers with a JSON array, parsed leniently. `Hybrid`: heuristic candidates refined by the LLM, falling back to the heuristic result with a warning if the provider fails.
- What the heuristic mines — **recovery**: a failed call whose tool later succeeds → `ErrorPattern` ("retry `X` after adjusting the input"); **strategy**: a successful chain of ≥3 calls → `Strategy` ("follow this order"); **waste**: ≥3 calls to one tool *within a single turn* → `Insight` tagged `optimization`. Sequential same-tool work across turns is ordinary and unmined.
- `ExtractionConfig` — `strategy`, `max_memories` (10, applied after sorting by quality and deduplicating identical lessons), `min_turns` (3), `include_failures` (false — but failures often hold the best recovery pairs), `llm_context_budget` (8,000 bytes).
- `ExtractionObserver` — register alongside `TrajectoryObserver`: at `on_run_end` it reads the ledger's newest parseable line (walking back past a torn trailing line) and mines on a spawned task. Never blocks teardown, never panics — outside a tokio runtime it warns and skips; extraction failures are logged and swallowed.
- Telemetry: the `memory.extract` span, `loopctl.memory.extract.attempts` (`outcome=ok|no_client|parse_error|api_error` — unparseable model output is tagged and counted separately from transport failures, and a clientless `Llm`/`Hybrid` pass settles on `no_client`), and per-category `loopctl.memory.extracted` counters with stable `snake_case` labels.

**Behavior notes**

- The LLM path takes the client at the call site — the crate pulls in no provider dependency, and hosts choose whether extraction spends tokens at all.
- Mined memories feed the consolidation pass (same module family): duplicates from repeated shapes merge away, unaccessed lessons decay out — extraction and curation compose.

Deep dive: [Memory](/extensions/memory/) — the extraction section.
