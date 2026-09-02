# Configuration — SessionConfig, RunConfig, and who owns what

loopctl splits settings into two layers, and knowing which layer owns what answers most "where do I set X?" questions. Sources: `src/config.rs`, `src/engine/core/lifecycle.rs`.

---

## The two layers

| | `SessionConfig` | `RunConfig` |
|---|---|---|
| Scope | The whole agent session — stable across runs | One `run()` call — fresh every time |
| Lives in | Given at `BareLoop::new(...)` | Given to each `run(input, &run_config)` |
| Owns | system prompt, context window, compaction knobs | max turns, parallel dispatch, memory amount, manager reset |
| Example change | "This session uses a 32k model" | "This particular task may take 100 turns" |

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

---

## `SessionConfig` — every field

| Field | Type | Default | Meaning |
|---|---|---|---|
| `system_prompt` | `Option<String>` | `None` | Sent as the system prompt every turn. `None` = no system prompt. |
| `context_window` | `u64` | `200_000` | The model's token limit. **Set this to your real model's window** — compaction is driven by it. `0` disables all window policy (nothing is ever "too big"). |
| `compact_threshold` | `u8` | `80` | Compaction trigger, as a percentage of the window. Crossing 80% → shrink before the next model call. Range clamped to 0–100. |
| `auto_compact` | `bool` | `true` | Master switch for *threshold* compaction. `false` = you manage the context yourself — **but the 95% emergency line still fires** (it is a hard safety net, not configurable off, except by `context_window: 0`). |

Notes that save an afternoon:

- The threshold comparison is **strict**: a payload exactly at 80% does not trigger; 80.001% does.
- `compact_threshold = 0` disables the threshold trigger (emergency line remains).
- Values over 100 are silently clamped (by the builders and by deserialization; direct struct construction bypasses the clamp — prefer builders).
- The compaction machinery is **seeded automatically**: if you never install a `ContextManager`, the constructor installs one with a default truncating compactor synced to these values. Setting `auto_compact: true` always means real machinery exists behind it.

## `RunConfig` — every field

| Field | Type | Default | Meaning |
|---|---|---|---|
| `max_turns` | `usize` | `200` | Hard cap on model turns for this run. |
| `parallel_tool_dispatch` | `ParallelDispatchConfig` | sequential, max 8 | How tool calls within a turn run. See [tool dispatch](../02-engine/04-tool-dispatch.md). |
| `reset_managers` | `bool` | `false` | `true` = wipe transient manager state (breaker, detectors, observers) at run start. Normally state persists across runs in a session. |
| `memory_top_k` | `usize` | `3` | How many memory entries to retrieve each turn. `0` disables memory injection. See [memory](../04-extensions/03-memory.md). |

`RunConfig` is `#[non_exhaustive]` — use builders (`.with_max_turns(n)`, `.with_parallel_dispatch(cfg)`), not struct literals, so future fields don't break your code.

### Where the two layers meet — `MachinePolicy`

Every loop iteration, the driver assembles the brain's policy fresh from *both* layers:

| Policy field | Comes from | Fallback when absent |
|---|---|---|
| `max_turns` | the **in-flight run's** `RunConfig` | `usize::MAX` (no run active) |
| `context_window` | `SessionConfig` | — |
| `compact_threshold` | `SessionConfig` | — |
| `auto_compact` | `SessionConfig` | — |

That split is exactly why a turn limit can change between two `run()` calls while the window policy stays stable for the session's life — and why the brain serializes with none of these numbers inside it: they are re-supplied, fresh, on every single step (see [the state machine](../02-engine/01-state-machine.md)).

### Parallel dispatch in one paragraph

```rust
RunConfig::default().with_parallel_dispatch(ParallelDispatchConfig {
    mode: ParallelMode::Parallel,     // or Sequential (default)
    max_concurrency: 8,               // default; clamped to the batch size
})
```

In `Parallel` mode, calls that declare themselves concurrency-safe run together (up to `max_concurrency`); unsafe calls and calls sharing a `resource_key` wait in separate waves. Results always come back in the order the model asked. One hard error in a wave cancels its siblings. Observers still pair events by `tool_call_id` — in parallel mode, arrival order is not call order.

---

## The third layer — features and per-request options

Two more places settings live, for completeness:

1. **Cargo features** decide what is compiled at all (`streaming`, `hooks`, `tool_health`, `tool_shield`, `redaction`, providers, `mcp`, `derive`, `testing`, ...). The crate's default is **no features** — a minimal build has no provider clients, no hooks, nothing optional. See the [provider overview](../05-providers/01-overview.md) for the full list.
2. **`RequestOptions`** (set with `agent.set_request_options(...)`) attach to every model request: a per-request model override, a forced JSON response format, or a strict-tools constraint. See [structured output](../06-integration/01-structured-output.md).

And two moments when config *changes* mid-life are legitimate:

- [`switch_model`](../02-engine/08-model-switch.md) can update the context window when the model changes.
- Every setter on `BareLoop` (`set_memory`, `set_pipeline`, `set_observer`, ...) must be called **before** the first `run()` — debug builds panic otherwise ("debug_assert_idle"), release builds merely misbehave.

---

## A real-world example — small local model

Small models drift off task, repeat calls, and emit broken arguments. The shipped `ConstrainedProfile` encodes the right settings:

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

Details: [presets](../06-integration/04-presets.md).

---

## Related pages

- [Compaction](../02-engine/06-compaction.md) — what the window/threshold numbers actually do.
- [The driver](../02-engine/02-driver-loop.md) — how config flows into the brain as `MachinePolicy`.
- [File reference: config.rs](../07-file-reference/config.md)
