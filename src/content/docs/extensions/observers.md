---
title: "Observers"
sidebar:
  order: 1
---

An observer gets notified about everything that happens in the engine. Runs starting and ending, turns, model replies, streaming text, tool calls, compactions, model switches, and loops.

Observers are read-only spectators. They cannot block anything and they cannot change anything, so reach for [hooks](/extensions/hooks/) when you need control. Sources are `src/observer.rs` and `src/observer/context.rs`.

Logging, metrics, progress bars, cost tracking, and live transcript displays are observer jobs.

## The trait: one required method

```rust
pub trait LoopObserver: Send + Sync {
    fn name(&self) -> &str;              // required — identifies you in logs
    // every other method defaults to no-op; override what you need
}
```

Register as many as you like. They fire in registration order, and a panicking observer is caught and logged, so one bad observer can never take your run down.

```rust
struct Metrics { requests: AtomicUsize }
impl LoopObserver for Metrics {
    fn name(&self) -> &str { "metrics" }
    fn on_tool_post(&self, ctx: &ToolPostContext) {
        if ctx.is_error { /* count failures */ }
    }
}
agent.register_observer(Arc::new(Metrics { requests: AtomicUsize::new(0) }));
```

## Every event, when it fires, and what it carries

| Event | Fires | Key context fields |
|---|---|---|
| `on_run_start` | Start of every `run()` | `session_id` |
| `on_turn_start` | Before each served model call. A turn deferred to compaction fires nothing, and a retried turn fires once. | `turn`, `query` which is the display text |
| `on_response` | Once per turn, after the full reply is assembled | `turn`, `text` with tool calls excluded, `usage` |
| `on_text_delta` / `on_thinking_delta` | Per streaming fragment | `turn`, `delta` which is the verbatim fragment |
| `on_attempt_reset` | Exactly once before the first event of each retried stream attempt, never on the first. Live displays use it to wipe the partial render. | `turn` |
| `on_tool_call_received` | Once per model-requested call, before any dispatch. This is the earliest per-call signal, it carries the input, and it fires even for pre-answered unknown tools. | `turn`, `tool`, `call_id`, `input` |
| `on_tool_pre` / `on_tool_post` | Per dispatch attempt, so retries re-fire both | `turn`, `tool`, `tool_call_id`. Post adds `result_hash`, `is_error`, `duration`, `display_hint`. |
| `on_gate_decision` | After every gated dispatch, as exactly one record ordered `tool_pre → gate → tool_post` (0.4.0). A dispatch no gate consulted emits none. | `turn`, `call_id`, `decision` which is the `GateDecision` |
| `on_turn_end` | End of the LLM phase and separately end of the tool phase, so one model turn with tools produces two events | `turn`, `success`, `error`, `duration_ms`, token counts, `stop_reason`, `history`, `context_tokens`, `context_window`. History is the machine's conversation at the boundary, committed plus this run's turns, `Arc`-shared. |
| `on_stream_success` / `on_stream_failure` | After each model call, with the model that served it | `turn`, `model`, `usage` or `error` |
| `on_transport_fallback` | When a turn was rescued by the non-streaming fallback, even when a later policy discards the record | `turn`, the fallback detail |
| `on_pre_compaction` | As a compaction pass starts, carrying the pre-pass snapshot | Trigger reason, pre-pass stats such as messages by role and the token estimate |
| `on_compaction` | Only when compaction actually happened, never on no-ops | Live `CompactTelemetry`: before and after stats, `tokens_saved`, the pass's wall-clock duration |
| `on_compaction_failed` | When a pass fails outright. At the run level this is typed `CompactionFailed` or `CompactionStalled`. | The payload-comparable numbers |
| `on_fallback` | When the breaker switches to a backup model | `from`, `to` |
| `on_model_switched` | On explicit switch and on every fallback routing change | `from`, `to` |
| `on_loop_detected` / `on_convergence_detected` | When detection flags a pattern | Pattern text plus repetitions or the action string |
| `on_budget_warn` | When a [budget gate](/safety/budget-gate/) soft line is crossed, once per run per dimension | The dimension and the numbers |
| `on_run_end` | Every run exit: success, error, or cancel | `success`, `error`, `total_turns`, `duration_ms`, `calibration_ratio_bp`, `context_figure`, `unfinished_input` |
| `reset` | Once per session start | Nothing |

## The fan-out machinery

How does a notification actually reach your observer? Six mechanics sit under that table:

- **One dispatch site per event.** Every `notify_*` lives in the engine's `emission.rs`, and the driver modules never fire observers directly. That centralization is why the table above is exhaustive. No code path can forget a notification, because each has exactly one home.

- **Sequential, in registration order, with no short-circuit.** The host walks its `Vec<Arc<dyn LoopObserver>>` and calls every entry, in order, every time.

- **Panic isolation.** Each callback is wrapped in `catch_unwind`. A panicking observer is logged with its `name()` and the panic message, and the walk continues with the others. That is the same discipline as tool dispatch, where one bad citizen cannot take your run down.

- **Run boundary ordering across observers and hooks.** At run start, observers go first and hooks follow. At run end, hooks go first and observers follow, so your `on_run_end` observer sees a state where auto-commit-style hooks have already done their work.

- **Contexts are cloned, not borrowed.** Each context is built with owned data, with strings cloned out of engine state. You can hold one indefinitely without aliasing the engine, and you cannot mutate anything through it.

- **`text_streamer` runs first.** For a text delta your streamer callback fires, and then `on_text_delta` goes to observers. Same fragment, two consumers, fixed order.

## Pairing tool events

Pair `on_tool_pre` with `on_tool_post` by `tool_call_id`, never by arrival order. Under parallel dispatch the events batch, under retries they repeat for the same logical call, and two calls to the same tool in one turn share `(turn, tool)`. The id is your only reliable key.

Compare `on_tool_call_received` with `on_tool_pre` the same way. The first fires once per call and carries the input. The second fires once per attempt and does not.

## Streaming deltas: two honest warnings

1. **Deltas of failed attempts fire too.** With a `StreamHandler` configured, the engine forwards every accepted event, including fragments of an attempt that later dies and replays. Reset on retry boundaries if you concatenate deltas into output, which is what the accumulator does.

2. **Keep delta handlers light.** They run inline on the stream-ingestion path, so append to a buffer and return, then render elsewhere.

For anything you commit, prefer `on_response` and `on_turn_end` over concatenated deltas.

One special case deserves its own note. An empty `on_thinking_delta` fragment means redacted reasoning, so render a placeholder rather than an empty string.

Reasoning text never appears in `on_response`, because its `text` field is visible text only. Consume it through `on_thinking_delta`, or read the assembled `MessagePart::Thinking` from the turn-end history snapshot.

## The simple cousin: text_streamer

If all you want is printing text as it arrives:

```rust
agent.set_text_streamer(Arc::new(|chunk: &str| {
    print!("{chunk}");       // same fragments on_text_delta receives
}));
```

That gives you one consumer, no trait, and no reset bookkeeping. The same failed-attempt caveat applies, so the committed text is always `Run::output` or `on_response`.

## A ready-made observer: trajectory capture

You do not have to write your own transcript keeper. `memory::trajectory::TrajectoryObserver` listens to these same events and assembles each run into a serializable `TrajectoryRecord`.

A record carries per-turn queries and responses, tool calls paired by `tool_call_id`, durations, token totals, and a three-way outcome of `Success`, `Failure`, or `Partial`. A retried call appears once per attempt.

Keep finished records in memory with `records()`, or optionally append one JSONL line per run to a directory with `writing_to(dir)`. Cap response text with `with_capture_limit`, which defaults to 2,000 characters.

Its sibling `EventLedgerObserver` writes the finer-grained per-event stream to `events.jsonl`, one `TrajectoryEvent` per engine event, covered in [the event hub](/extensions/event-hub/). Details are in the [file reference](/file-reference/memory-trajectory/) and in [Memory](/extensions/memory/).

## The metric stream: counters on loopctl::metrics

Apart from observer callbacks, the engine emits metric events on the `loopctl::metrics` `tracing` target at `debug` level. That is a structured counter stream for anyone running a metrics collector, and you subscribe through `tracing` rather than through the `LoopObserver` trait.

Most subsystems document their own counters inline. Compaction has `loopctl.compaction.*`, the estimator has `loopctl.estimate.calibration`, and embedding batching has `loopctl.embed.batch`. Four engine-wide additions are worth knowing:

- **`loopctl.tools.calls`** fires one event per settled dispatch on both dispatch paths, the direct registry and the middleware pipeline. It is emitted at the single exit they share, so no call is double-counted and none is missed. Fields are `tool`, `outcome` as `ok` or `error`, and `duration_ms`.

- **`loopctl.memory.retrieve.results`** fires one event per memory retrieve, labeled by `trigger`. The label is `turn` for the engine's passive per-turn retrieve and `tool` for an active search your model ran through `SearchMemories`. Both carry `outcome`, `k_requested`, and `k_returned`, which makes the passive-versus-active split in [Memory](/extensions/memory/) visible in the stream.

- **Span to counter renames** moved several 0.3.x span-style events into counter style under the `loopctl.` prefix. Notably `vector.index.search` became `loopctl.vector.index.search` and `vector.embed` became `loopctl.vector.embed`, so every vector tier, whether linear, HNSW, Qdrant, or pgvector, now emits the same names.

- **Deprecated** is `loopctl.think.calls` from the `Think` tool, shipped 0.3.1. It is redundant double-counting, because the engine's `loopctl.tools.calls` already counts every Think call. It still fires for backward compatibility and is slated for removal in a later `0.Y.0`. See [Think](/file-reference/tool-builtin-think/).

## From observer to event stream

Need many consumers of one event stream, say a TUI and a metrics collector and a logger, or consumers living in other tasks? Register one [`EventHub`](/extensions/event-hub/) as your observer and subscribe to its broadcast channel. That is the observer-to-stream adapter.

## Gotchas

- Registering the same observer twice gives you double notifications, because there is no dedup.

- Observers fire after the fact they describe, synchronously, on the engine's tasks. Heavy work belongs in a channel you hand off to.

- `RunEndContext::total_turns` counts only turns that finished, so an in-flight turn at the moment of a fatal error is not included.

- `CompactedContext::tokens_after` excludes transient extras riding the next request, so do not use it to predict the next request's exact size.

- `on_compaction` fires after the conversation was already rewritten. It is a receipt, not a checkpoint.

## Related pages

- [Hooks](/extensions/hooks/) is the controlling counterpart.
- [Anatomy of a run](/start-here/anatomy-of-a-run/) shows where each event sits in the flow.
- [`TrajectoryObserver`, file reference](/file-reference/memory-trajectory/) covers the built-in observer that turns events into run records.
