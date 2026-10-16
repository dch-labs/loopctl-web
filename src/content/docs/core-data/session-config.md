---
title: "Configuration"
sidebar:
  order: 6
---

loopctl splits settings into two layers. Knowing which layer owns what answers most "where do I set X?" questions before you search. Sources: `src/config.rs`, `src/engine/core/lifecycle.rs`.

## The two layers

| | `SessionConfig` | `RunConfig` |
|---|---|---|
| Scope | The whole agent session, stable across runs | One `run()` call, fresh every time |
| Lives in | Given at `BareLoop::new(...)` | Given to each `run(input, &run_config)` |
| Owns | system prompt, context window, compaction knobs | max turns, parallel dispatch, memory amount, manager reset |
| Example change | "This session uses a 32k model" | "This particular task may take 100 turns" |

You set the session layer once and the run layer per task:

```rust
let config = SessionConfig::default()
    .with_system_prompt("You are a careful research assistant.")
    .with_context_window(32_000)
    .with_compact_threshold(75);

let mut agent = BareLoop::new(client, tools, config);

let result = agent
    .run("Summarize this folder", &RunConfig::default().with_max_turns(100))
    .await?;
```

Note where the two numbers land: the window belongs to the session, and the turn cap belongs to the run.

## SessionConfig fields

You set these four fields once, when you build the loop:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `system_prompt` | `Option<String>` | `None` | Sent as the system prompt every turn. `None` means no system prompt. |
| `context_window` | `u64` | `200_000` | The model's token limit, as a declaration. Set this to your real model's window, because compaction is driven by it. Since 0.4.0 a client that discloses its real window through `model_context_window` outranks this declaration at run start. `0` is the deliberate opt-out: it disables all window policy, so nothing is ever too big, and it beats any disclosure. See [context accounting](/engine/context-accounting/). |
| `compact_threshold` | `u8` | `80` | Compaction trigger, as a percentage of the window. Crossing 80% shrinks the context before the next model call. Range clamped to 0 to 100. |
| `auto_compact` | `bool` | `true` | Master switch for threshold compaction. With `false` you manage the context yourself, but the 95% emergency line still fires. That line is a hard safety net and cannot be configured off, except by `context_window: 0`. |

Four notes save you an afternoon:

- The threshold comparison is strict. A payload exactly at 80% does not trigger, and 80.001% does.
- `compact_threshold = 0` disables the threshold trigger. The emergency line remains.
- Values over 100 are silently clamped by the builders and by deserialization. Direct struct construction bypasses the clamp, so prefer builders.
- The compaction machinery is seeded automatically. If you never install a `ContextManager`, the constructor installs one with a default truncating compactor synced to these values. Setting `auto_compact: true` always means real machinery exists behind it.

## RunConfig fields

| Field | Type | Default | Meaning |
|---|---|---|---|
| `max_turns` | `usize` | `200` | Hard cap on model turns for this run. |
| `parallel_tool_dispatch` | `ParallelDispatchConfig` | sequential, max 8 | How tool calls within a turn run. See [tool dispatch](/engine/tool-dispatch/). |
| `reset_managers` | `bool` | `false` | With `true` you wipe transient manager state at run start, which covers the breaker, detectors, and observers. Normally that state persists across runs in a session. Set it with `with_reset_managers(true)`. |
| `memory_top_k` | `usize` | `3` | How many memory entries to retrieve each turn. `0` disables memory injection, but a `0` does not disable the model's own `SearchMemoriesTool` if you registered one. See [memory](/extensions/memory/). |
| `memory_include_provider_derived` | `bool` | `false` | Whether LLM-authored memories tagged `provider-derived` may be injected. The default excludes them, so untrusted model text never reaches a prompt unless you opt in. |

`RunConfig` is `#[non_exhaustive]`, so use builders such as `.with_max_turns(n)` and `.with_parallel_dispatch(cfg)`. Struct literals would break your code when a field is added.

### MachinePolicy

Every loop iteration, the driver assembles the brain's policy fresh from both layers:

| Policy field | Comes from | Fallback when absent |
|---|---|---|
| `max_turns` | the in-flight run's `RunConfig` | `usize::MAX`, meaning no run is active |
| `context_window` | `SessionConfig` | none |
| `compact_threshold` | `SessionConfig` | none |
| `auto_compact` | `SessionConfig` | none |

That split is why a turn limit can change between two `run()` calls while the window policy stays stable for the session's life. It is also why the brain serializes with none of these numbers inside it. They are re-supplied fresh on every step. See [the state machine](/engine/state-machine/).

### Parallel dispatch

Turn parallel dispatch on like this:

```rust
RunConfig::default().with_parallel_dispatch(ParallelDispatchConfig {
    mode: ParallelMode::Parallel,     // or Sequential (default)
    max_concurrency: 8,               // default; clamped to the batch size
})
```

In `Parallel` mode, calls that declare themselves concurrency-safe run together up to `max_concurrency`. Unsafe calls and calls sharing a `resource_key` wait in separate waves. Results always come back in the order the model asked for them.

Two consequences to check your code against. One hard error in a wave cancels its siblings. And observers still pair events by `tool_call_id`, because in parallel mode arrival order is not call order.

## Features and request options

Two more places settings live:

1. Cargo features decide what is compiled at all, including `streaming`, `hooks`, `tool_health`, `tool_shield`, `redaction`, the providers, `mcp`, `derive`, and `testing`. The crate's default is no features, so a minimal build has no provider clients, no hooks, and nothing optional. The [provider overview](/providers/overview/) lists them all.
2. `RequestOptions` attach to every model request once you call `agent.set_request_options(...)`. You can carry a per-request model override, a forced JSON response format, or a strict-tools constraint. See [structured output](/integration/structured-output/).

Two moments where changing configuration mid-life is legitimate:

- [`switch_model`](/engine/model-switch/) can update the context window when the model changes.
- Every setter on `BareLoop`, such as `set_memory`, `set_pipeline`, and `set_observer`, must run before your first `run()`. Debug builds panic with `debug_assert_idle`, and release builds misbehave instead.

## A real-world example, small local model

Small models drift off task, repeat calls, and emit broken arguments. The shipped `ConstrainedProfile` encodes the settings that fix it:

```rust
use loopctl::presets::ConstrainedProfile;

let mut agent = BareLoop::new(
    client,
    tools,
    ConstrainedProfile::session_config(),   // 32k window, defaults otherwise
);
agent.set_request_options(ConstrainedProfile::request_options());  // strict tool schemas
ConstrainedProfile::apply(&mut agent)?;     // compaction + middleware + goal reminder
let result = agent.run(task, &ConstrainedProfile::run_config()).await?;  // max 100 turns
```

Four calls, and each one is a layer from above: session config, request options, middleware, run config. If you want the reasoning behind each default, Details are in [presets](/integration/presets/).

## Related pages

- [Compaction](/engine/compaction/) covers what the window and threshold numbers actually do.
- [The driver](/engine/driver-loop/) covers how config flows into the brain as `MachinePolicy`.
- [File reference: config.rs](/file-reference/config/)
