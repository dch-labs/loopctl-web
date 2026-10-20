# File reference — one page per source file

Every file in `loopctl/src/`, the companion crates under `crates/` (`derive`, `sqlite`, `hnsw`, `client`, `vector` — moved there in 0.4.0), and the supporting trees, in plain words. Each page: what the file is, its key items, its behavior notes, and a link to the deep-dive article.

Use this when you're *in the code* and want to know what the file in front of you does — or when you're looking for *where* something lives.

## The crate root & foundations

| File | One line |
|---|---|
| [`lib.rs`](lib.md) | Crate root — module wiring and the feature gates. |
| [`message.rs`](message.md) | The conversation data model: `Message`, parts (incl. signed thinking), roles, tool content, retention. |
| [`error.rs`](error.md) | `LoopError` — the one error enum, plus the lock-poison policy. |
| [`config.rs`](config.md) | `SessionConfig` — system prompt, context window, compaction knobs. |
| [`cancel.rs`](cancel.md) | `CancelSignal` — cooperative cancellation. |
| [`capabilities.rs`](capabilities.md) | Small traits asking "does this bundle have X?" |
| [`contributor.rs`](contributor.md) | `ContextContributor` — per-turn message injection. |
| [`attachment.rs`](attachment.md) | Pinned per-turn context (file / memory / todo) that compaction cannot touch (0.4.1). |
| [`numeric.rs`](numeric.md) | Internal safe-math helpers (not public). |
| [`managers.rs`](managers.md) | `LoopManagers` — the bundle of optional components (ask resolver, clock/id seams). |
| [`presets.rs`](presets.md) | Constrained/Frontier profiles + `GoalReminder` (Constrained is the default wiring since 0.4.0). |
| [`budget.rs`](budget.md) | `BudgetGate` — soft/hard spend lines consulted before each request. |
| [`ask.rs`](ask.md) | The external-approver channel — park a run at a hook's ask, resume on the answer. |
| [`determinism.rs`](determinism.md) | `Clock`/`IdGen`/`Rng` seams — same run, same bytes. |
| [`manifest.rs`](manifest.md) | The `loop.yaml` model: parse → merge → interpolate → validate → hash [feature: manifest]. |

## Talking to models

| File | One line |
|---|---|
| [`api.rs`](api.md) | The `ApiClient` trait and request/response carriers. |
| [`api/error.rs`](api-error.md) | `ApiError` + `ErrorCode` — provider errors classified. |
| [`stream.rs`](stream.md) | Stream events, deltas, stop reasons, the accumulator. |
| [`stream/handler.rs`](stream-handler.md) | `StreamHandler` — retries, timeouts, fallback. |
| [`stream/rate_limit.rs`](stream-rate-limit.md) | Token-bucket rate limiter. |
| [`structured.rs`](structured.md) | Structured (JSON) output: trait, formats, constraints. |
| [`provider.rs`](provider.md) | Provider profiles + shared HTTP plumbing. |
| [`provider/openai.rs`](provider-openai.md) | OpenAI client (base of the compatible family). |
| [`provider/anthropic.rs`](provider-anthropic.md) | Anthropic client (base of Z.ai path). |
| [`provider/gemini.rs`](provider-gemini.md) | Gemini client. |
| [`provider/bedrock.rs`](provider-bedrock.md) | AWS Bedrock client (signing, two wire paths). |
| [`provider/embeddings.rs`](provider-embeddings.md) | `OllamaEmbedder` + `OpenAiEmbedder` — the real `EmbeddingProvider` backends. |
| [`provider/sse.rs`](provider-sse.md) | The SSE reader shared by the clients. |
| [`provider/grammar.rs`](provider-grammar.md) | Grammar constraints for local samplers. |

## The engine

| File | One line |
|---|---|
| [`engine.rs`](engine.md) / [`engine/core.rs`](engine-core.md) | Module roots (re-exports). |
| [`engine/core/machine.rs`](engine-machine.md) | **The brain** — the pure state machine. |
| [`engine/core/lifecycle.rs`](engine-lifecycle.md) | `Loop` trait, `Run`/`Session`/`Turn`, `RunConfig`. |
| [`engine/core/outcome.rs`](engine-outcome.md) | Outcome → error translation. |
| [`engine/bare.rs`](engine-bare.md) | **The hands** — the driver loop and its handlers. |
| [`engine/bare/llm_turn.rs`](engine-bare-llm-turn.md) | Building and sending one model request. |
| [`engine/bare/dispatch.rs`](engine-bare-dispatch.md) | The tool-call pipeline and recovery. |
| [`engine/bare/compact.rs`](engine-bare-compact.md) | The driver side of compaction. |
| [`engine/bare/prune.rs`](engine-bare-prune.md) | The no-LLM tool-output reclamation pass (opt-in `PruneConfig`). |
| [`engine/bare/emission.rs`](engine-bare-emission.md) | All observer/hook fan-out. |
| [`engine/bare/config.rs`](engine-bare-config.md) | The `set_*`/`with_*` builders, temp dir. |
| [`engine/bare/model_switch.rs`](engine-bare-model-switch.md) | Atomic mid-session model change. |
| [`engine/bare/steering.rs`](engine-bare-steering.md) | The `Steering` slot — host guidance drained at turn boundaries (0.4.1). |
| [`engine/bare/tests.rs`](engine-bare-tests.md) | The engine's own test suite (in-file). |

## Tools & safety

| File | One line |
|---|---|
| [`tool.rs`](tool.md) | The `Tool` trait, outputs, errors, contexts, retention classes. |
| [`tool/builtin/read.rs`](tool-builtin-read.md) | `ReadTool` + `ContentSource` — line-aware reads over any source [feature: builtin_tools]. |
| [`tool/builtin/fs.rs`](tool-builtin-fs.md) | `Write`/`Edit`/`MultiEdit`/`FileViewer` + `FileSource` [feature: fs_tools]. |
| [`tool/builtin/search.rs`](tool-builtin-search.md) | `Glob`/`Grep`/`CodeSearch`/`Tree` over a `SearchSource` [feature: search_tools]. |
| [`tool/builtin/shell.rs`](tool-builtin-shell.md) | `Shell` + `Jobs` over a `ShellBackend` [feature: shell_tools]. |
| [`tool/builtin/think.rs`](tool-builtin-think.md) | `ThinkTool` — the planning scratchpad (`Think` since 0.4.0) [feature: builtin_tools]. |
| [`tool/registry.rs`](tool-registry.md) | `ToolRegistry` + `FnTool` (runtime-mutable since 0.4.1). |
| [`tool/selector.rs`](tool-selector.md) | The per-turn tool advertisement: `ToolSelector`, `KeywordSelector`, the async family (0.4.1). |
| [`tool/permission.rs`](tool-permission.md) | `PermissionCheck` + `GateDecision` — the decision type and its audit record. |
| [`tool/grant.rs`](tool-grant.md) | `GrantStore` — persisted approvals with narrow scopes [feature: file_grants]. |
| [`tool/health.rs`](tool-health.md) | Per-tool stats and circuit breakers. |
| [`tool/shield.rs`](tool-shield.md) | The safety shield trait + `UnixShield`. |
| [`middleware.rs`](middleware.md) | The pipeline core: trait, context, builder. |
| [`middleware/tool_call.rs`](middleware-tool-call.md) | The pipeline's innermost core (registry call). |
| [`middleware/timeout.rs`](middleware-timeout.md) | Per-call deadline. |
| [`middleware/permission.rs`](middleware-permission.md) | Policy enforcement layer. |
| [`middleware/output_limit.rs`](middleware-output-limit.md) | Output size cap. |
| [`middleware/unknown_tool.rs`](middleware-unknown-tool.md) | "Did you mean...?" suggestions. |
| [`middleware/memoize.rs`](middleware-memoize.md) | The tool-result cache. |
| [`middleware/verify.rs`](middleware-verify.md) | Post-write verification. |
| [`middleware/redaction.rs`](middleware-redaction.md) | Secret scrubbing. |
| [`middleware/shield.rs`](middleware-shield.md) | The shield's pipeline wiring. |
| [`detection/loop_detector.rs`](detection-loop-detector.md) | Repeated-operation detection. |
| [`detection/convergence.rs`](detection-convergence.md) | Repeated-answer detection. |
| [`detection/manager.rs`](detection-manager.md) + [`detection.rs`](detection.md) | The detection facade and the module-root re-exports. |
| [`fallback.rs`](fallback.md) | Model-level circuit breaker + chain. |
| [`reflection.rs`](reflection.md) | Reflector + RecoveryStrategy traits. |
| [`reflection/llm.rs`](reflection-llm.md) | The model-powered reflector. |
| [`reflection/backoff.rs`](reflection-backoff.md) | Exponential backoff strategy. |

## Watching & extending

| File | One line |
|---|---|
| [`observer.rs`](observer.md) + [`observer/context.rs`](observer-context.md) | The `LoopObserver` trait + event payloads. |
| [`observer/hub.rs`](observer-hub.md) | `EventHub` — one observer feeding a broadcast `LoopEvent` stream. |
| [`hooks.rs`](hooks.md) + [`hooks/context.rs`](hooks-context.md) | The `Hook` trait + contexts. |
| [`hooks/executor.rs`](hooks-executor.md) | First-block-wins execution. |
| [`hooks/builtin/*`](hooks-builtin.md) | AutoCommit, Blocklist, Confirmation, Logging. |
| [`memory.rs`](memory.md) + [`entry.rs`](memory-entry.md) + [`builtin.rs`](memory-builtin.md) + [`score.rs`](memory-builtin.md) | The memory trait, entries, in-memory store, shared retrieval scorer. |
| [`memory/file.rs`](memory-file.md) | `FileMemoryStore` — JSONL persistence that survives a restart (`file_memory`). |
| [`memory/trajectory.rs`](memory-trajectory.md) + [`memory/trajectory/sink.rs`](memory-trajectory.md) | `TrajectoryObserver` — each run as a serializable record (memory + JSONL ledger). |
| [`memory/consolidate.rs`](memory-consolidate.md) | Quality scoring, category-weighted decay, duplicate merging — the consolidation primitives. |
| [`memory/extractor.rs`](memory-extractor.md) | Mines learned memories from recorded runs (`MemoryExtractor`). |
| [`memory/vector.rs`](memory-vector.md) | `EmbeddingProvider` + `VectorIndex` primitives and reference impls (`vector_index`). |
| [`memory/vector_memory.rs`](memory-vector-memory.md) | `VectorMemoryStore` — the semantic `LoopMemory` backend + the golden-set bar (`vector_memory`). |
| [`memory/search_tool.rs`](memory-search-tool.md) | `SearchMemoriesTool` — the model-callable memory search. |
| [`compact.rs`](compact.md) + [`types.rs`](compact-types.md) + [`truncating.rs`](compact-truncating.md) | Compaction manager, outcome types, truncator. |
| [`compact/qa_summarizer.rs`](compact-qa-summarizer.md) | `QaSummarizer` — the three-step LLM compactor. |
| [`compact/structured_summarizer.rs`](compact-structured-summarizer.md) | `StructuredSummarizer` — sectioned summaries with stable headings. |
| [`compact/fallback.rs`](compact-fallback.md) | `FallbackCompactor` — the never-fail chain with `TerminalCapture`. |
| [`compact/demote.rs`](compact-demote.md) | `DemotionSink` + `MemoryDemotionSink` + `render_evicted`. |
| [`compact/rolling.rs`](compact-rolling.md) | `RollingCompactor` — the maintenance-cadence compactor. |

## Integration & support

| File | One line |
|---|---|
| [`mcp.rs`](mcp.md) | MCP client side (import foreign tools). |
| [`mcp/server.rs`](mcp-server.md) | MCP server side (serve your registry). |
| [`mcp/convert.rs`](mcp-convert.md) | The type conversion layer between worlds. |
| [`testing.rs`](testing.md) | Mocks and fixtures. |
| [`crates/derive/src/*`](derive-lib.md) | The `#[derive(Tool)]` macro crate. |
| [`crates/sqlite/`](sqlite-crate.md) | `loopctl-sqlite` — durable SQLite `LoopMemory` (WAL, FTS5, ranking parity). |
| [`crates/client/`](client-crate.md) | `loopctl-client` — the shared daemon client (UDS REST + SSE, both modes). |
| [`crates/hnsw/`](hnsw-crate.md) | `loopctl-hnsw` — the HNSW `VectorIndex` companion. |
| [`crates/vector/`](vector-crate.md) | `loopctl-vector` — Qdrant + pgvector backends (side workspace). |
| [`examples & tests`](examples-tests.md) | The runnable tour. |
