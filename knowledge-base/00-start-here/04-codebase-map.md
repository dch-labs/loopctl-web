# The codebase map — every piece of loopctl, one line each

loopctl lives in `src/`. Below is the whole map: what each module is for, in one or two lines, with links to the deep-dive article. Feature names in brackets (like `[feature: streaming]`) mean the module only exists when you enable that Cargo feature. The companion crates (`derive`, `sqlite`, `hnsw`, `client`, and the side-workspace `vector`) live under `crates/` — 0.4.0 moved them there from the repo top level.

```text
loopctl/
├── src/                    the library itself
│   ├── lib.rs              crate root — module wiring, docs
│   ├── engine/             THE agent loop (brain + hands)
│   ├── api.rs              the ApiClient trait: "how to talk to a model"
│   ├── provider/           ready-made clients: OpenAI, Anthropic, Gemini, Bedrock...
│   │                       embeddings.rs — real embedders (Ollama /api/embed, OpenAI /v1/embeddings)
│   ├── stream.rs           streaming event types + the accumulator that assembles them
│   ├── message.rs          Message, MessagePart, roles — the conversation data model
│   ├── attachment.rs       pinned context that rides every request, immune to compaction
│   ├── tool.rs             the Tool trait and its output/error types
│   ├── tool/builtin/       shipped tools, each behind its own feature flag:
│   │                       read.rs — line-aware ReadTool over a pluggable ContentSource
│   │                       fs.rs — Write/Edit/MultiEdit/FileViewer + FileSource (fs_tools)
│   │                       search.rs — Glob/Grep/CodeSearch/Tree over a SearchSource (search_tools)
│   │                       shell.rs — the Shell + Jobs tools over a ShellBackend (shell_tools)
│   │                       think.rs — the planning scratchpad (builtin_tools)
│   ├── tool/registry.rs    ToolRegistry — name → tool lookup, mutable at runtime
│   ├── tool/selector.rs    ToolSelector/AsyncToolSelector — which tools each turn advertises
│   ├── tool/permission.rs  PermissionCheck + GateDecision (decisions as audit data)
│   ├── tool/grant.rs       the GrantStore — persisted approval grants (file_grants)
│   ├── tool/health.rs      per-tool circuit breakers [feature: tool_health]
│   ├── tool/shield.rs      tool safety scoring (UnixShield) [feature: tool_shield]
│   ├── middleware/         a pipeline that wraps every tool call (timeout, caps, cache...)
│   ├── hooks/              control-flow interception (block a tool before it runs) [feature: hooks]
│   ├── ask.rs              the external-approver channel: park a run, resume on approval
│   ├── budget.rs           BudgetGate — soft/hard spend lines consulted before each request
│   ├── observer.rs         watch everything that happens (no control)
│   │                       hub.rs — EventHub: observers → one broadcast event stream
│   ├── memory.rs           long-term memory for the agent
│   ├── memory/             trajectory.rs — capture each run as a record (JSONL or memory)
│   │                       trajectory/events.rs — the per-event ledger (TrajectoryEvent stream)
│   │                       consolidate.rs — decay, merge, prune: memory curation primitives
│   │                       extractor.rs — mine learned memories from recorded runs
│   │                       file.rs — JSONL-persistent memory store [feature: file_memory]
│   │                       score.rs — the shared retrieval scorer (ranking parity across backends)
│   │                       vector.rs — embedding + nearest-neighbour primitives [feature: vector_index]
│   │                       vector_memory.rs — the semantic LoopMemory backend [feature: vector_memory]
│   │                       search_tool.rs — SearchMemoriesTool: the model queries memory itself
│   ├── detection/          is the model stuck? (loop + convergence detection)
│   ├── fallback.rs         circuit breaker over the model itself (switch to a backup model)
│   ├── reflection/         analyze a failed tool call, decide how to retry
│   ├── compact.rs          shrink the conversation when it nears the context window
│   ├── compact/            the compactor family:
│   │                       qa_summarizer.rs — the three-step LLM summarizer
│   │                       structured_summarizer.rs — sectioned summaries with stable headings
│   │                       fallback.rs — the never-fail chain (quality-descending, terminal truncate)
│   │                       demote.rs — evicted turns become retrievable memories
│   │                       rolling.rs — the rolling compactor over retention classes
│   ├── cancel.rs           the cancellation signal (cooperative Ctrl-C)
│   ├── config.rs           SessionConfig — session-level settings
│   ├── error.rs            LoopError — the one error enum for everything
│   ├── capabilities.rs     small traits: "does this bundle have observers? memory?"
│   ├── contributor.rs      inject a reminder message before each turn
│   ├── determinism.rs      injectable clock / id / rng seams — same run, same bytes
│   ├── manifest.rs         the loop.yaml manifest model (parse → resolve → validate) [feature: manifest]
│   ├── manifest/           merge.rs, interpolate.rs, validate.rs, schema.rs, types.rs, error.rs
│   ├── managers.rs         LoopManagers — one bundle holding every optional part
│   ├── presets.rs          ready-made settings profiles (Constrained, Frontier)
│   ├── structured.rs       force the model to answer in JSON you can parse
│   ├── mcp.rs              speak the MCP protocol (use foreign tools, serve your own) [feature: mcp]
│   ├── testing.rs          fake model client + fake tools for your tests [feature: testing]
│   └── numeric.rs          internal safe-math helpers (not public)
├── crates/                 companion crates — 0.4.0 moved them here into a workspace
│   ├── derive/             #[derive(Tool)] generates the Tool impl
│   ├── sqlite/             loopctl-sqlite, durable SQLite memory
│   ├── hnsw/               loopctl-hnsw, the HNSW VectorIndex
│   ├── client/             loopctl-client, the shared daemon client
│   └── vector/             side-workspace crate: loopctl-vector, Qdrant + pgvector backends
├── examples/               runnable example programs
└── tests/                  integration tests
```

---

## The engine — where the loop lives

| File | What it is |
|---|---|
| `src/engine/core/machine.rs` | The **brain** (`LoopMachine`): holds the conversation, decides each step, serializable. |
| `src/engine/core/lifecycle.rs` | The `Loop` trait and the run records: `Run`, `Session`, `Turn`, `RunConfig`, `TurnMode`. |
| `src/engine/core/outcome.rs` | Translates a finished run (`MachineOutcome`) into the error you see (`LoopError`). |
| `src/engine/bare.rs` | The **hands** (`BareLoop`): the `run()` loop, the three handlers, `finalize()`. |
| `src/engine/bare/llm_turn.rs` | How one model call is built and sent (streaming or not). |
| `src/engine/bare/dispatch.rs` | How tool calls run — the full per-call pipeline, sequential or parallel. |
| `src/engine/bare/compact.rs` | The driver side of a compaction pass. |
| `src/engine/bare/prune.rs` | The no-LLM tool-output reclamation pass (opt-in `PruneConfig`). |
| `src/engine/bare/emission.rs` | Every observer/hook notification is fanned out from here. |
| `src/engine/bare/config.rs` | All the `set_*` / `with_*` builder methods of `BareLoop`. |
| `src/engine/bare/model_switch.rs` | `switch_model()` — change the model atomically mid-session. |
| `src/engine/bare/steering.rs` | The `Steering` slot — guidance a host pushes to a running loop, drained at turn boundaries (0.4.1). |

Deep dives: [state machine](../02-engine/01-state-machine.md) · [driver loop](../02-engine/02-driver-loop.md) · [compaction](../02-engine/06-compaction.md) · [steering](../02-engine/10-steering.md) · [history rewind](../02-engine/11-history-rewind.md) · [context accounting](../02-engine/09-context-accounting.md)

## Talking to models

| File | What it is |
|---|---|
| `src/api.rs` | The `ApiClient` trait — implement this to use any model provider. |
| `src/api/error.rs` | `ApiError` — provider errors, plus "is this worth retrying?" classification. |
| `src/stream.rs` | Streaming events (`StreamEvent` deltas) and the accumulator that assembles a full reply from them. |
| `src/stream/handler.rs` | `StreamHandler` — retries, timeouts, rate-limit handling, fallback to non-streaming [feature: streaming]. |
| `src/stream/rate_limit.rs` | A token-bucket rate limiter, shared per provider endpoint. |
| `src/provider.rs` | Shared provider plumbing + one-function profiles (`ollama()`, `deepseek()`, ...). |
| `src/provider/openai.rs` | OpenAI client (also the base for Ollama, DeepSeek, Grok, Azure, Moonshot). |
| `src/provider/anthropic.rs` | Anthropic (Claude) client — also the base for Z.ai; prompt-cache breakpoints. |
| `src/provider/gemini.rs` | Google Gemini client. |
| `src/provider/bedrock.rs` | AWS Bedrock client — request signing, two wire formats. |
| `src/provider/embeddings.rs` | `OllamaEmbedder` + `OpenAiEmbedder` — the real `EmbeddingProvider` backends. |
| `src/provider/sse.rs` | The reader for SSE (Server-Sent Events) — how streaming bytes arrive. |
| `src/provider/grammar.rs` | Grammar-constrained tool calls for local models (vLLM `guided_json`). |

Deep dives: [API client](../01-core-data/03-api-client.md) · [stream events](../01-core-data/04-stream-events.md) · [providers](../05-providers/01-overview.md) · [embeddings](../05-providers/08-embeddings.md)

## Tools and safety around them

| File | What it is |
|---|---|
| `src/tool.rs` | The `Tool` trait, `ToolOutput`, `ToolError`, `ToolContext`, display hints, retention classes. |
| `src/tool/builtin/read.rs` | `ReadTool` + `ContentSource` — line-aware reads over any source. |
| `src/tool/builtin/fs.rs` | `WriteTool`/`EditTool`/`MultiEditTool`/`FileViewerTool` + `FileSource` [feature: fs_tools]. |
| `src/tool/builtin/search.rs` | `Glob`/`Grep`/`CodeSearch`/`Tree` over a `SearchSource` [feature: search_tools]. |
| `src/tool/builtin/shell.rs` | `Shell` + `Jobs` over a `ShellBackend` [feature: shell_tools]. |
| `src/tool/builtin/think.rs` | `ThinkTool` — the planning scratchpad [feature: builtin_tools]. |
| `src/tool/registry.rs` | `ToolRegistry` — where tools are registered and looked up (mutably, since 0.4.1); plus `FnTool`. |
| `src/tool/selector.rs` | The per-turn tool advertisement: `ToolSelector`, `KeywordSelector`, the async family (0.4.1). |
| `src/tool/permission.rs` | `PermissionCheck` + `GateDecision` — the decision type and its audit record. |
| `src/tool/grant.rs` | `GrantStore` — persisted approvals with narrow scopes [feature: file_grants]. |
| `src/tool/health.rs` | Per-tool failure counting and circuit breakers [feature: tool_health]. |
| `src/tool/shield.rs` | `ToolSafetyShield` and `UnixShield` — risk scoring of dangerous commands [feature: tool_shield]. |
| `src/middleware.rs` | The middleware pipeline: layers around every tool call. |
| `src/middleware/timeout.rs` | Kill a tool call that takes too long. |
| `src/middleware/permission.rs` | Deny / ask / modify calls via your own policy function. |
| `src/middleware/output_limit.rs` | Cap tool output size. |
| `src/middleware/unknown_tool.rs` | Add "Did you mean...?" suggestions for unknown tool names. |
| `src/middleware/memoize.rs` | Cache tool results (reads) and invalidate on writes. |
| `src/middleware/verify.rs` | Run a verifier after write-class tools ("does it still compile?"). |
| `src/middleware/redaction.rs` | Scrub secrets from tool output [feature: redaction]. |
| `src/middleware/shield.rs` | Wire a safety shield into the pipeline [feature: tool_shield]. |

Deep dives: [tools](../01-core-data/02-tools.md) · [tool selection](../01-core-data/07-tool-selection.md) · [middleware](../03-safety/01-middleware.md) · [tool health](../03-safety/06-tool-health.md) · [shield](../03-safety/07-tool-shield.md)

## Watching and steering

| File | What it is |
|---|---|
| `src/observer.rs` | `LoopObserver` — get notified about everything (no control). |
| `src/observer/context.rs` | The event payloads observers receive. |
| `src/observer/hub.rs` | `EventHub` — one observer feeding a broadcast `LoopEvent` stream. |
| `src/hooks/` | `Hook` — allow/block tool calls and compaction [feature: hooks]. |
| `src/hooks/builtin/auto_commit.rs` | Auto-`git commit` the files your agent edited. |
| `src/hooks/builtin/blocklist_hook.rs` | Simple block/allow lists of tool names. |
| `src/hooks/builtin/confirmation_hook.rs` | Ask a human before named tools run. |
| `src/hooks/builtin/logging_hook.rs` | Debug-log every hook event. |
| `src/ask.rs` | The external-approver channel — park a run at a hook's ask, resume on the answer. |
| `src/managers.rs` | `LoopManagers` — the one bundle holding every optional component. |

Deep dives: [observers](../04-extensions/01-observers.md) · [hooks](../04-extensions/02-hooks.md) · [approvals](../03-safety/09-approvals.md) · [managers](../04-extensions/05-managers.md)

## Keeping the agent healthy

| File | What it is |
|---|---|
| `src/detection/loop_detector.rs` | Detects the same tool call repeating with the same result. |
| `src/detection/convergence.rs` | Detects the model repeating near-identical final answers. |
| `src/detection/manager.rs` | `DetectionManager` — owns both detectors, used by the engine. |
| `src/fallback.rs` | `FallbackManager` — breaker over the model; switch to a backup when the primary fails. |
| `src/reflection.rs` | Analyze a failed tool call (`Reflector`), decide the retry (`RecoveryStrategy`). |
| `src/reflection/llm.rs` | Ask the model itself to analyze the failure. |
| `src/reflection/backoff.rs` | Retry with exponentially growing delays. |
| `src/memory/` | `LoopMemory` trait + the in-memory store; `file.rs` persists it to JSONL (`file_memory`); `consolidate.rs`/`score.rs` are the curation and ranking primitives every backend shares; `extractor.rs` mines learned memories from recorded runs; `trajectory.rs` captures each run as a serializable record; `trajectory/events.rs` is the per-event ledger; `vector.rs` holds the embedding primitives, `vector_memory.rs` the semantic store, `search_tool.rs` the model-callable search. |
| `src/cancel.rs` | `CancelSignal` — cooperative cancellation, safe to share across tasks. |

Deep dives: [loop detection](../03-safety/02-loop-detection.md) · [fallback](../03-safety/04-fallback.md) · [reflection](../03-safety/05-reflection.md) · [memory](../04-extensions/03-memory.md) · [cancellation](../02-engine/05-cancellation.md)

## Data, config, errors

| File | What it is |
|---|---|
| `src/message.rs` | The conversation data model. |
| `src/config.rs` | `SessionConfig`: system prompt, context window, compaction knobs. |
| `src/error.rs` | `LoopError` — one enum for every failure, with "is it worth retrying?" answers. |
| `src/capabilities.rs` | Small traits asking "does this bundle have X?" |
| `src/contributor.rs` | Inject a message (e.g. a goal reminder) before each turn. |
| `src/attachment.rs` | Pinned per-turn context (file / memory / todo) that compaction cannot touch (0.4.1). |
| `src/compact.rs` | `ContextManager`, compactors, token counting — the whole shrink-the-conversation subsystem. |
| `src/structured.rs` | Get parsed JSON answers out of the model. |
| `src/determinism.rs` | `Clock`/`IdGen`/`Rng` seams — inject a fixed clock or seeded generator, get byte-stable runs. |
| `src/manifest.rs` | The `loop.yaml` model: parse, deep-merge profiles, interpolate `${VAR}`, validate, hash [feature: manifest]. |
| `src/presets.rs` | `ConstrainedProfile` / `FrontierProfile` — curated settings bundles. |

Deep dives: [messages](../01-core-data/01-messages.md) · [errors](../01-core-data/05-errors.md) · [session config](../01-core-data/06-session-config.md) · [compaction](../02-engine/06-compaction.md) · [manifest](../06-integration/06-manifest.md)

## Everything else

| Path | What it is |
|---|---|
| `crates/derive/` | The `loopctl-derive` crate: `#[derive(Tool)]` writes the Tool impl for you. |
| `crates/sqlite/` | The `loopctl-sqlite` crate: a durable SQLite-backed memory store (bundled rusqlite, WAL). |
| `crates/hnsw/` | The `loopctl-hnsw` crate: an HNSW `VectorIndex` — approximate nearest-neighbour search at scale. |
| `crates/client/` | The `loopctl-client` crate: the family's shared daemon client (UDS REST + SSE, one interface for in-process and daemon modes). |
| `crates/vector/` | The `loopctl-vector` crate (side workspace): external vector stores — Qdrant and pgvector backends for `VectorIndex`. |
| `examples/` | Eleven runnable examples, from hello-world to vector memory. |
| `tests/` | Integration tests — good reading for "how is X supposed to behave?" — plus the `cassettes/` corpus and `golden/` request bytes. |
| `Makefile` | `make ci`, `make test`, `make lint`, `make e2e` and friends. |
| `TESTING.md` | The project's testing philosophy (written, but useful to users too). |

Deep dives: [derive macro](../06-integration/03-derive-macro.md) · [MCP](../06-integration/02-mcp.md) · [testing](../06-integration/05-testing.md) · [loopctl-client](../06-integration/07-loopctl-client.md) · [file-by-file reference](../07-file-reference/README.md)
