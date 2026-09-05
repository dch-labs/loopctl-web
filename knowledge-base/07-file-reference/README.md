# File reference — one page per source file

Every file in `loopctl/src/`, the `derive/` crate, and the supporting trees, in plain words. Each page: what the file is, its key items, its behavior notes, and a link to the deep-dive article.

Use this when you're *in the code* and want to know what the file in front of you does — or when you're looking for *where* something lives.

## The crate root & foundations

| File | One line |
|---|---|
| [`lib.rs`](lib.md) | Crate root — module wiring and the feature gates. |
| [`message.rs`](message.md) | The conversation data model: `Message`, parts, roles, tool content. |
| [`error.rs`](error.md) | `LoopError` — the one error enum, plus the lock-poison policy. |
| [`config.rs`](config.md) | `SessionConfig` — system prompt, context window, compaction knobs. |
| [`cancel.rs`](cancel.md) | `CancelSignal` — cooperative cancellation. |
| [`capabilities.rs`](capabilities.md) | Small traits asking "does this bundle have X?" |
| [`contributor.rs`](contributor.md) | `ContextContributor` — per-turn message injection. |
| [`numeric.rs`](numeric.md) | Internal safe-math helpers (not public). |
| [`managers.rs`](managers.md) | `LoopManagers` — the bundle of optional components. |
| [`presets.rs`](presets.md) | Constrained/Frontier profiles + `GoalReminder`. |

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
| [`engine/bare/emission.rs`](engine-bare-emission.md) | All observer/hook fan-out. |
| [`engine/bare/config.rs`](engine-bare-config.md) | The `set_*`/`with_*` builders, temp dir. |
| [`engine/bare/model_switch.rs`](engine-bare-model-switch.md) | Atomic mid-session model change. |
| [`engine/bare/tests.rs`](engine-bare-tests.md) | The engine's own test suite (in-file). |

## Tools & safety

| File | One line |
|---|---|
| [`tool.rs`](tool.md) | The `Tool` trait, outputs, errors, contexts. |
| [`tool/builtin.rs`](tool-builtin-think.md) + [`tool/builtin/think.rs`](tool-builtin-think.md) | Built-in tools (`builtin_tools`): `ThinkTool`, the planning scratchpad. |
| [`tool/registry.rs`](tool-registry.md) | `ToolRegistry` + `FnTool`. |
| [`tool/permission.rs`](tool-permission.md) | `PermissionCheck` — the decision type. |
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
| [`detection/manager.rs`](detection-manager.md) | The detection facade (+ `detection.rs` root). |
| [`fallback.rs`](fallback.md) | Model-level circuit breaker + chain. |
| [`reflection.rs`](reflection.md) | Reflector + RecoveryStrategy traits. |
| [`reflection/llm.rs`](reflection-llm.md) | The model-powered reflector. |
| [`reflection/backoff.rs`](reflection-backoff.md) | Exponential backoff strategy. |

## Watching & extending

| File | One line |
|---|---|
| [`observer.rs`](observer.md) + [`observer/context.rs`](observer-context.md) | The `LoopObserver` trait + event payloads. |
| [`hooks.rs`](hooks.md) + [`hooks/context.rs`](hooks-context.md) | The `Hook` trait + contexts. |
| [`hooks/executor.rs`](hooks-executor.md) | First-block-wins execution. |
| [`hooks/builtin/*`](hooks-builtin.md) | AutoCommit, Blocklist, Confirmation, Logging. |
| [`memory.rs`](memory.md) + [`entry.rs`](memory-entry.md) + [`builtin.rs`](memory-builtin.md) | The memory trait, entries, in-memory store. |
| [`memory/trajectory.rs`](memory-trajectory.md) + [`memory/trajectory/sink.rs`](memory-trajectory.md) | `TrajectoryObserver` — each run as a serializable record (memory + JSONL ledger). |
| [`memory/vector.rs`](memory-vector.md) | `EmbeddingProvider` + `VectorIndex` primitives and reference impls (`vector_index`). |
| [`compact.rs`](compact.md) + [`types.rs`](compact-types.md) + [`truncating.rs`](compact-truncating.md) | Compaction manager, outcome types, truncator. |

## Integration & support

| File | One line |
|---|---|
| [`mcp.rs`](mcp.md) | MCP client side (import foreign tools). |
| [`mcp/server.rs`](mcp-server.md) | MCP server side (serve your registry). |
| [`mcp/convert.rs`](mcp-convert.md) | The type conversion layer between worlds. |
| [`testing.rs`](testing.md) | Mocks and fixtures. |
| [`derive/src/*`](derive-lib.md) | The `#[derive(Tool)]` macro crate. |
| [`examples & tests`](examples-tests.md) | The runnable tour. |
