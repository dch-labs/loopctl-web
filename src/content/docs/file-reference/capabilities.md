---
title: "src/capabilities.rs"
---

This file gives you nine small traits, one per optional engine component, so your code can depend on "has detection" without depending on the whole bundle. `LoopManagers` implements all of them.

## Key items

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

## Behavior notes

Your `Option` returns encode "not configured", so the engine checks and skips cleanly.

`StreamCapable` is the exception: it substitutes a no-resilience passthrough, so "is a real handler set?" is not answerable through the accessor.

Narrow your generic code to the traits it needs, as in `fn foo(b: &impl Detectable)`. That is the entire point of this module.

Deep dive: [Managers](/extensions/managers/).
