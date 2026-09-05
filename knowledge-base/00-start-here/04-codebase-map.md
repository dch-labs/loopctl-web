# The codebase map — every piece of loopctl, one line each

loopctl lives in `src/`. Below is the whole map: what each module is for, in one or two lines, with links to the deep-dive article. Feature names in brackets (like `[feature: streaming]`) mean the module only exists when you enable that Cargo feature.

```text
loopctl/
├── src/                    the library itself
│   ├── lib.rs              crate root — module wiring, docs
│   ├── engine/             THE agent loop (brain + hands)
│   ├── api.rs              the ApiClient trait: "how to talk to a model"
│   ├── provider/           ready-made clients: OpenAI, Anthropic, Gemini, Bedrock...
│   ├── stream.rs           streaming event types + the accumulator that assembles them
│   ├── message.rs          Message, MessagePart, roles — the conversation data model
│   ├── tool.rs             the Tool trait and its output/error types
│   ├── tool/builtin/       shipped tools: think.rs — the planning scratchpad [feature: builtin_tools]
│   ├── tool/registry.rs    ToolRegistry — name → tool lookup
│   ├── tool/permission.rs  PermissionCheck — allow / deny / ask / modify
│   ├── tool/health.rs      per-tool circuit breakers [feature: tool_health]
│   ├── tool/shield.rs      tool safety scoring (UnixShield) [feature: tool_shield]
│   ├── middleware/         a pipeline that wraps every tool call (timeout, caps, cache...)
│   ├── hooks/              control-flow interception (block a tool before it runs) [feature: hooks]
│   ├── observer.rs         watch everything that happens (no control) 
│   ├── memory.rs           long-term memory for the agent
│   ├── memory/             trajectory.rs — capture each run as a record (JSONL or memory)
│   │                       vector.rs — embedding + nearest-neighbour primitives [feature: vector_index]
│   ├── detection/          is the model stuck? (loop + convergence detection)
│   ├── fallback.rs         circuit breaker over the model itself (switch to a backup model)
│   ├── reflection/         analyze a failed tool call, decide how to retry
│   ├── compact.rs          shrink the conversation when it nears the context window
│   ├── cancel.rs           the cancellation signal (cooperative Ctrl-C)
│   ├── config.rs           SessionConfig — session-level settings
│   ├── error.rs            LoopError — the one error enum for everything
│   ├── capabilities.rs     small traits: "does this bundle have observers? memory?"
│   ├── contributor.rs      inject a reminder message before each turn
│   ├── managers.rs         LoopManagers — one bundle holding every optional part
│   ├── presets.rs          ready-made settings profiles (Constrained, Frontier)
│   ├── structured.rs       force the model to answer in JSON you can parse
│   ├── mcp.rs              speak the MCP protocol (use foreign tools, serve your own)
│   ├── testing.rs          fake model client + fake tools for your tests [feature: testing]
│   └── numeric.rs          internal safe-math helpers (not public)
├── derive/                 a companion crate: #[derive(Tool)] generates the Tool impl
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
| `src/engine/bare/emission.rs` | Every observer/hook notification is fanned out from here. |
| `src/engine/bare/config.rs` | All the `set_*` / `with_*` builder methods of `BareLoop`. |
| `src/engine/bare/model_switch.rs` | `switch_model()` — change the model atomically mid-session. |

Deep dives: [state machine](../02-engine/01-state-machine.md) · [driver loop](../02-engine/02-driver-loop.md) · [compaction](../02-engine/06-compaction.md)

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
| `src/provider/anthropic.rs` | Anthropic (Claude) client — also the base for Z.ai. |
| `src/provider/gemini.rs` | Google Gemini client. |
| `src/provider/bedrock.rs` | AWS Bedrock client — request signing, two wire formats. |
| `src/provider/sse.rs` | The reader for SSE (Server-Sent Events) — how streaming bytes arrive. |
| `src/provider/grammar.rs` | Grammar-constrained tool calls for local models (vLLM `guided_json`). |

Deep dives: [API client](../01-core-data/03-api-client.md) · [stream events](../01-core-data/04-stream-events.md) · [providers](../05-providers/01-overview.md)

## Tools and safety around them

| File | What it is |
|---|---|
| `src/tool.rs` | The `Tool` trait, `ToolOutput`, `ToolError`, `ToolContext`, display hints. |
| `src/tool/registry.rs` | `ToolRegistry` — where tools are registered and looked up; plus `FnTool`. |
| `src/tool/permission.rs` | `PermissionCheck` — the allow/deny/ask/modify decision type. |
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

Deep dives: [tools](../01-core-data/02-tools.md) · [middleware](../03-safety/01-middleware.md) · [tool health](../03-safety/06-tool-health.md) · [shield](../03-safety/07-tool-shield.md)

## Watching and steering

| File | What it is |
|---|---|
| `src/observer.rs` | `LoopObserver` — get notified about everything (no control). |
| `src/observer/context.rs` | The event payloads observers receive. |
| `src/hooks/` | `Hook` — allow/block tool calls and compaction [feature: hooks]. |
| `src/hooks/builtin/auto_commit.rs` | Auto-`git commit` the files your agent edited. |
| `src/hooks/builtin/blocklist_hook.rs` | Simple block/allow lists of tool names. |
| `src/hooks/builtin/confirmation_hook.rs` | Ask a human before named tools run. |
| `src/hooks/builtin/logging_hook.rs` | Debug-log every hook event. |
| `src/managers.rs` | `LoopManagers` — the one bundle holding every optional component. |

Deep dives: [observers](../04-extensions/01-observers.md) · [hooks](../04-extensions/02-hooks.md) · [managers](../04-extensions/05-managers.md)

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
| `src/memory/` | `LoopMemory` trait + a simple in-memory store; `memory/trajectory.rs` captures each run as a serializable record (`TrajectoryObserver`, JSONL ledger). |
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
| `src/compact.rs` | `ContextManager`, compactors, token counting — the whole shrink-the-conversation subsystem. |
| `src/structured.rs` | Get parsed JSON answers out of the model. |
| `src/presets.rs` | `ConstrainedProfile` / `FrontierProfile` — curated settings bundles. |

Deep dives: [messages](../01-core-data/01-messages.md) · [errors](../01-core-data/05-errors.md) · [session config](../01-core-data/06-session-config.md) · [compaction](../02-engine/06-compaction.md)

## Everything else

| Path | What it is |
|---|---|
| `derive/` | The `loopctl-derive` crate: `#[derive(Tool)]` writes the Tool impl for you. |
| `examples/` | Eight runnable examples, from hello-world to MCP servers. |
| `tests/` | Integration tests — good reading for "how is X supposed to behave?" |
| `Makefile` | `make ci`, `make test`, `make lint`, `make e2e` and friends. |
| `TESTING.md` | The project's testing philosophy (written, but useful to users too). |

Deep dives: [derive macro](../06-integration/03-derive-macro.md) · [MCP](../06-integration/02-mcp.md) · [testing](../06-integration/05-testing.md) · [file-by-file reference](../07-file-reference/README.md)
