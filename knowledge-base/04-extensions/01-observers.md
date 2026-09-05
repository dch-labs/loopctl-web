# Observers — watch everything, change nothing

An **observer** gets notified about everything that happens in the engine: runs starting and ending, turns, model replies, streaming text, tool calls, compactions, model switches, loops. Observers are **read-only spectators** — they cannot block or change anything (for that, see [hooks](02-hooks.md)). Sources: `src/observer.rs`, `src/observer/context.rs`.

Logging, metrics, progress bars, cost tracking, live transcript displays — those are observer jobs.

---

## The trait — one required method, everything optional

```rust
pub trait LoopObserver: Send + Sync {
    fn name(&self) -> &str;              // required — identifies you in logs
    // every other method defaults to no-op; override what you need
}
```

Register any number of them; they fire **in registration order**, and a panicking observer is caught and logged — one bad observer can never take the run down.

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
| `on_run_start` | start of every `run()` | `session_id` |
| `on_turn_start` | before each **served** model call (a turn deferred to compaction fires nothing; the retried turn fires once) | `turn`, `query` (display text) |
| `on_response` | once per turn, after the full reply is assembled | `turn`, `text` (tool calls excluded), `usage` |
| `on_text_delta` / `on_thinking_delta` | per streaming fragment | `turn`, `delta` (verbatim fragment) |
| `on_tool_call_received` | once per model-requested call, before any dispatch — the earliest per-call signal; carries the input; fires even for pre-answered unknown tools | `turn`, `tool`, `call_id`, `input` |
| `on_tool_pre` / `on_tool_post` | per dispatch **attempt** (retries re-fire both) | `turn`, `tool`, `tool_call_id`; post adds `result_hash`, `is_error`, `duration`, `display_hint` |
| `on_turn_end` | end of the LLM phase and (separately) end of the tool phase — one model turn with tools produces **two** events | `turn`, `success`, `error`, `duration_ms`, token counts |
| `on_stream_success` / `on_stream_failure` | after each model call, with the model that served it | `turn`, `model`, `usage` / `error` |
| `on_compaction` | only when compaction **actually happened** (never on no-ops) | `tokens_before`, `tokens_after`, `tokens_saved` |
| `on_fallback` | when the breaker switches to a backup model | `from`, `to` |
| `on_model_switched` | on explicit switch and on every fallback routing change | `from`, `to` |
| `on_loop_detected` / `on_convergence_detected` | when detection flags a pattern | pattern text + repetitions / action string |
| `on_run_end` | every run exit — success, error, cancel | `success`, `error`, `total_turns`, `duration_ms` |
| `reset` | once per session start | — |

## The fan-out machinery, exactly

How a notification actually reaches your observer — the mechanics under the table above:

- **One dispatch site per event.** Every `notify_*` lives in the engine's `emission.rs` — the driver modules never fire observers directly. That centralization is why the event table above is exhaustive: no code path can "forget" a notification, because there is exactly one home for each.
- **Sequential, registration order, no short-circuit.** The host walks its `Vec<Arc<dyn LoopObserver>>` and calls every one, in order, every time. Nothing an observer does (including panicking — below) affects the others.
- **Panic isolation.** Each callback is wrapped in `catch_unwind`; a panicking observer is logged with its `name()` and the panic message, and the walk **continues with the remaining observers**. The same discipline as tool dispatch: one bad citizen can't take the run down.
- **Ordering across observers *and* hooks at run boundaries.** Run start: observers first, then hooks. Run end: **hooks first, then observers** — so an `on_run_end` observer sees a state where auto-commit-style hooks have already done their work.
- **Contexts are cloned, not borrowed.** Each context is built with owned data (strings cloned out of engine state), so an observer can hold onto it indefinitely without aliasing the engine — and can't mutate anything through it.
- **`text_streamer` runs first.** For a text delta, your streamer callback fires, *then* `on_text_delta` goes to observers — same fragment, two consumers, fixed order.

## Pairing tool events — the rule

Pair `on_tool_pre` with `on_tool_post` by **`tool_call_id`**, never by arrival order. Under parallel dispatch the events batch; under retries they repeat for the same logical call; two calls to the same tool in one turn share `(turn, tool)`. The id is the only reliable key.

Similarly, `on_tool_call_received` vs `on_tool_pre`: the former is once **per call** (and carries the input); the latter once **per attempt** (without the input).

## Streaming deltas — two honest warnings

1. **Deltas of failed attempts fire too.** With a `StreamHandler` configured, the engine forwards every accepted event — including fragments of an attempt that later dies and replays. If you concatenate deltas into committed output, reset on retry boundaries (the accumulator does exactly this), or simply use `on_response` / `on_turn_end` for anything committed.
2. **Keep delta handlers light.** They run inline on the stream-ingestion path. Append to a buffer and return; render elsewhere.

Special case: an **empty** `on_thinking_delta` fragment means *redacted reasoning* — render a placeholder, not an empty string. Reasoning text never appears in `on_response` — it is stream-only by design.

## The simple cousin — `text_streamer`

If all you want is "print text as it arrives":

```rust
agent.set_text_streamer(Arc::new(|chunk: &str| {
    print!("{chunk}");       // same fragments on_text_delta receives
}));
```

One consumer, no trait, no reset bookkeeping — but the same failed-attempt caveat applies. The committed text is always `Run::output` / `on_response`.

## A ready-made observer — trajectory capture

You don't have to write your own transcript keeper: `memory::trajectory::TrajectoryObserver` listens to these same events and assembles each run into a serializable `TrajectoryRecord` — per-turn queries and responses, tool calls paired by `tool_call_id` (a retried call appears once per attempt), durations, token totals, and a three-way outcome (`Success` / `Failure` / `Partial`). Keep finished records in memory (`records()`), optionally append one JSONL line per run to a directory (`writing_to(dir)`), and cap response text with `with_capture_limit` (default 2,000 characters). See the [file reference](../07-file-reference/memory-trajectory.md) and [Memory](03-memory.md).

---

## Gotchas

- Registering the same observer twice = double notifications (no dedup).
- Observers fire **after** the fact they describe, synchronously, on the engine's tasks — heavy work belongs in a channel you hand off to.
- `RunEndContext::total_turns` counts only turns that finished — an in-flight turn at the moment of a fatal error is not included.
- `CompactedContext::tokens_after` excludes transient extras riding the next request — don't use it to predict the next request's exact size.
- `on_compaction` fires *after* the conversation was already rewritten — it's a receipt, not a checkpoint.

---

## Related pages

- [Hooks](02-hooks.md) — the controlling counterpart.
- [Anatomy of a run](../00-start-here/03-anatomy-of-a-run.md) — where each event sits in the flow.
- [`TrajectoryObserver` (file reference)](../07-file-reference/memory-trajectory.md) — a built-in observer that turns events into run records.
