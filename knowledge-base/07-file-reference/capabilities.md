# `src/capabilities.rs` — the capability traits

Nine small traits, one per optional engine component, so code can depend on "has detection" without depending on the whole bundle. `LoopManagers` implements all of them.

**Key items**

| Trait | Method | Returns |
|---|---|---|
| `Observable` | `observers()` | `&ObserverHost` |
| `Detectable` | `detection()` | `&DetectionManager` |
| `FallbackCapable` | `fallback()` | `&FallbackManager` |
| `Compactable` | `context_manager()` | `Option<&Arc<ContextManager>>` |
| `RememberCapable` | `memory()` | `Option<&Arc<dyn LoopMemory>>` |
| `StreamCapable` [streaming] | `stream_handler()` | `&StreamHandler` — **never None** (passthrough default) |
| `Hookable` [hooks] | `hook_executor()` | `Option<&HookExecutor>` |
| `PipelineAware` | `pipeline()` | `Option<&ToolPipeline>` |
| `HealthTrackable` [tool_health] | `health_registry()` | `Option<&ToolHealthRegistry>` |

**Behavior notes**

- The `Option` returns encode "not configured" — the engine checks and skips cleanly. `StreamCapable` is the exception: it substitutes a no-resilience passthrough, so "is a real handler set?" is not answerable through the accessor.
- Generic code should narrow to the traits it needs (`fn foo(b: &impl Detectable)`) — that's the entire point of this module.

Deep dive: [Managers](../04-extensions/05-managers.md).
