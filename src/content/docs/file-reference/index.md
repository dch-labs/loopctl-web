---
title: "File reference — one page per source file"
sidebar:
  order: 0
---


Every file in `loopctl/src/`, the `derive/` crate, and the supporting trees, in plain words. Each page: what the file is, its key items, its behavior notes, and a link to the deep-dive article.

Use this when you're *in the code* and want to know what the file in front of you does — or when you're looking for *where* something lives.

## The crate root & foundations

| File | One line |
|---|---|
| [`lib.rs`](/file-reference/lib/) | Crate root — module wiring and the feature gates. |
| [`message.rs`](/file-reference/message/) | The conversation data model: `Message`, parts, roles, tool content. |
| [`error.rs`](/file-reference/error/) | `LoopError` — the one error enum, plus the lock-poison policy. |
| [`config.rs`](/file-reference/config/) | `SessionConfig` — system prompt, context window, compaction knobs. |
| [`cancel.rs`](/file-reference/cancel/) | `CancelSignal` — cooperative cancellation. |
| [`capabilities.rs`](/file-reference/capabilities/) | Small traits asking "does this bundle have X?" |
| [`contributor.rs`](/file-reference/contributor/) | `ContextContributor` — per-turn message injection. |
| [`numeric.rs`](/file-reference/numeric/) | Internal safe-math helpers (not public). |
| [`managers.rs`](/file-reference/managers/) | `LoopManagers` — the bundle of optional components. |
| [`presets.rs`](/file-reference/presets/) | Constrained/Frontier profiles + `GoalReminder`. |

## Talking to models

| File | One line |
|---|---|
| [`api.rs`](/file-reference/api/) | The `ApiClient` trait and request/response carriers. |
| [`api/error.rs`](/file-reference/api-error/) | `ApiError` + `ErrorCode` — provider errors classified. |
| [`stream.rs`](/file-reference/stream/) | Stream events, deltas, stop reasons, the accumulator. |
| [`stream/handler.rs`](/file-reference/stream-handler/) | `StreamHandler` — retries, timeouts, fallback. |
| [`stream/rate_limit.rs`](/file-reference/stream-rate-limit/) | Token-bucket rate limiter. |
| [`structured.rs`](/file-reference/structured/) | Structured (JSON) output: trait, formats, constraints. |
| [`provider.rs`](/file-reference/provider/) | Provider profiles + shared HTTP plumbing. |
| [`provider/openai.rs`](/file-reference/provider-openai/) | OpenAI client (base of the compatible family). |
| [`provider/anthropic.rs`](/file-reference/provider-anthropic/) | Anthropic client (base of Z.ai path). |
| [`provider/gemini.rs`](/file-reference/provider-gemini/) | Gemini client. |
| [`provider/bedrock.rs`](/file-reference/provider-bedrock/) | AWS Bedrock client (signing, two wire paths). |
| [`provider/sse.rs`](/file-reference/provider-sse/) | The SSE reader shared by the clients. |
| [`provider/grammar.rs`](/file-reference/provider-grammar/) | Grammar constraints for local samplers. |

## The engine

| File | One line |
|---|---|
| [`engine.rs`](/file-reference/engine/) / [`engine/core.rs`](/file-reference/engine-core/) | Module roots (re-exports). |
| [`engine/core/machine.rs`](/file-reference/engine-machine/) | **The brain** — the pure state machine. |
| [`engine/core/lifecycle.rs`](/file-reference/engine-lifecycle/) | `Loop` trait, `Run`/`Session`/`Turn`, `RunConfig`. |
| [`engine/core/outcome.rs`](/file-reference/engine-outcome/) | Outcome → error translation. |
| [`engine/bare.rs`](/file-reference/engine-bare/) | **The hands** — the driver loop and its handlers. |
| [`engine/bare/llm_turn.rs`](/file-reference/engine-bare-llm-turn/) | Building and sending one model request. |
| [`engine/bare/dispatch.rs`](/file-reference/engine-bare-dispatch/) | The tool-call pipeline and recovery. |
| [`engine/bare/compact.rs`](/file-reference/engine-bare-compact/) | The driver side of compaction. |
| [`engine/bare/emission.rs`](/file-reference/engine-bare-emission/) | All observer/hook fan-out. |
| [`engine/bare/config.rs`](/file-reference/engine-bare-config/) | The `set_*`/`with_*` builders, temp dir. |
| [`engine/bare/model_switch.rs`](/file-reference/engine-bare-model-switch/) | Atomic mid-session model change. |
| [`engine/bare/tests.rs`](/file-reference/engine-bare-tests/) | The engine's own test suite (in-file). |

## Tools & safety

| File | One line |
|---|---|
| [`tool.rs`](/file-reference/tool/) | The `Tool` trait, outputs, errors, contexts. |
| [`tool/builtin.rs`](/file-reference/tool-builtin-think/) + [`tool/builtin/think.rs`](/file-reference/tool-builtin-think/) | Built-in tools (`builtin_tools`): `ThinkTool`, the planning scratchpad. |
| [`tool/registry.rs`](/file-reference/tool-registry/) | `ToolRegistry` + `FnTool`. |
| [`tool/permission.rs`](/file-reference/tool-permission/) | `PermissionCheck` — the decision type. |
| [`tool/health.rs`](/file-reference/tool-health/) | Per-tool stats and circuit breakers. |
| [`tool/shield.rs`](/file-reference/tool-shield/) | The safety shield trait + `UnixShield`. |
| [`middleware.rs`](/file-reference/middleware/) | The pipeline core: trait, context, builder. |
| [`middleware/tool_call.rs`](/file-reference/middleware-tool-call/) | The pipeline's innermost core (registry call). |
| [`middleware/timeout.rs`](/file-reference/middleware-timeout/) | Per-call deadline. |
| [`middleware/permission.rs`](/file-reference/middleware-permission/) | Policy enforcement layer. |
| [`middleware/output_limit.rs`](/file-reference/middleware-output-limit/) | Output size cap. |
| [`middleware/unknown_tool.rs`](/file-reference/middleware-unknown-tool/) | "Did you mean...?" suggestions. |
| [`middleware/memoize.rs`](/file-reference/middleware-memoize/) | The tool-result cache. |
| [`middleware/verify.rs`](/file-reference/middleware-verify/) | Post-write verification. |
| [`middleware/redaction.rs`](/file-reference/middleware-redaction/) | Secret scrubbing. |
| [`middleware/shield.rs`](/file-reference/middleware-shield/) | The shield's pipeline wiring. |
| [`detection/loop_detector.rs`](/file-reference/detection-loop-detector/) | Repeated-operation detection. |
| [`detection/convergence.rs`](/file-reference/detection-convergence/) | Repeated-answer detection. |
| [`detection/manager.rs`](/file-reference/detection-manager/) | The detection facade (+ `detection.rs` root). |
| [`fallback.rs`](/file-reference/fallback/) | Model-level circuit breaker + chain. |
| [`reflection.rs`](/file-reference/reflection/) | Reflector + RecoveryStrategy traits. |
| [`reflection/llm.rs`](/file-reference/reflection-llm/) | The model-powered reflector. |
| [`reflection/backoff.rs`](/file-reference/reflection-backoff/) | Exponential backoff strategy. |

## Watching & extending

| File | One line |
|---|---|
| [`observer.rs`](/file-reference/observer/) + [`observer/context.rs`](/file-reference/observer-context/) | The `LoopObserver` trait + event payloads. |
| [`hooks.rs`](/file-reference/hooks/) + [`hooks/context.rs`](/file-reference/hooks-context/) | The `Hook` trait + contexts. |
| [`hooks/executor.rs`](/file-reference/hooks-executor/) | First-block-wins execution. |
| [`hooks/builtin/*`](/file-reference/hooks-builtin/) | AutoCommit, Blocklist, Confirmation, Logging. |
| [`memory.rs`](/file-reference/memory/) + [`entry.rs`](/file-reference/memory-entry/) + [`builtin.rs`](/file-reference/memory-builtin/) | The memory trait, entries, in-memory store. |
| [`memory/trajectory.rs`](/file-reference/memory-trajectory/) + [`memory/trajectory/sink.rs`](/file-reference/memory-trajectory/) | `TrajectoryObserver` — each run as a serializable record (memory + JSONL ledger). |
| [`memory/vector.rs`](/file-reference/memory-vector/) | `EmbeddingProvider` + `VectorIndex` primitives and reference impls (`vector_index`). |
| [`compact.rs`](/file-reference/compact/) + [`types.rs`](/file-reference/compact-types/) + [`truncating.rs`](/file-reference/compact-truncating/) | Compaction manager, outcome types, truncator. |

## Integration & support

| File | One line |
|---|---|
| [`mcp.rs`](/file-reference/mcp/) | MCP client side (import foreign tools). |
| [`mcp/server.rs`](/file-reference/mcp-server/) | MCP server side (serve your registry). |
| [`mcp/convert.rs`](/file-reference/mcp-convert/) | The type conversion layer between worlds. |
| [`testing.rs`](/file-reference/testing/) | Mocks and fixtures. |
| [`derive/src/*`](/file-reference/derive-lib/) | The `#[derive(Tool)]` macro crate. |
| [`examples & tests`](/file-reference/examples-tests/) | The runnable tour. |
