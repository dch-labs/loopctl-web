# Testing your agent — the mock toolkit [feature: testing]

Testing an agent against a live model is slow, flaky, and costs money. loopctl's `testing` feature gives you a scripted fake model client and fake tools, so your agent logic runs end-to-end in milliseconds with zero network. Source: `src/testing.rs`. Enable: `loopctl = { features = ["testing"] }` in `[dev-dependencies]`.

---

## `MockApiClient` — a model with a script

```rust
use loopctl::testing::{MockApiClient, MockResponse, MockToolCall};

let client = MockApiClient::new("test-model").with_responses(vec![
    // Turn 0: the model wants to call a tool.
    MockResponse {
        text: String::new(),
        tool_call: Some(MockToolCall {
            id: "call_1".into(),
            name: "echo".into(),
            input: json!({"message": "hi"}),
        }),
        stop_reason: "tool_use".into(),
    },
    // Turn 1: the final answer.
    MockResponse { text: "Done!".into(), tool_call: None, stop_reason: "end_turn".into() },
]);
```

Facts that make it pleasant:

- **The script replays** — the last queued response repeats forever, so a run that overshoots its script never crashes the test.
- It emits **the exact event sequence a real provider does** (message start, text deltas, tool-call deltas, terminal events) — streaming code paths get exercised for real.
- Usage is reported as a fixed 50 input / 25 output tokens (so token-accounting assertions have something to bite).
- `set_model` works (so [`switch_model`](../02-engine/08-model-switch.md) is testable), and a per-request model override is honored — the response names the routed model, so fallback-routing tests can observe the routing.
- `with_error("...")` makes every call fail — provider-failure paths without a provider.
- `with_text_response("...")` is the one-liner for single-turn tests.
- **`response_format` requests are served with the canned text as-is** — the mock can't enforce a schema (it has no model), which is exactly what structured-output parse-failure tests need: feed it prose, watch your error handling work. **`tool_constraint` is rejected loudly** (it shapes the tool-calling path the mock scripts — better a clear error than a lie).

### The mock's stream, event by event

Exactly what `stream_messages` yields for one canned response — the same shape a real provider produces, which is why streaming code paths can't tell the difference:

```text
MessageStart  { id: "msg_test", role: assistant, model }
PartStart     (0, text)
IndexedDelta  (0, Text { <the whole canned text as ONE delta> })
PartStop      { index: Some(0) }
              ── only when the script has a tool call:
PartStart     (1, tool_call with an EMPTY input)
IndexedDelta  (1, InputJson { the full arguments JSON })
PartStop      { index: Some(1) }
MessageDelta  { stop_reason, usage: 50 input / 25 output }
MessageStop
```

Two deliberate details: the text arrives as a **single delta** (no artificial chunking — if your test needs multi-fragment assembly, that's accumulator territory, covered by the crate's own tests), and the tool lane opens with an **empty input that then streams its arguments** — mirroring how real providers deliver tool calls piecemeal, so accumulated tool input is byte-identical on mock and real paths. The non-streaming twin builds the same parts in the same lane order (text first, then tool call).

## The wire, recorded — asserting on what was actually sent

The mock also remembers what reached it, so tests can pin the exact request shape rather than just the outcome:

- **`captured_requests()`** — clones of every served `create_message` request, oldest first. A request rejected before sending (unsupported options) is never captured — it never reached the wire.
- **`create_message_calls()` / `with_options_calls()`** — disjoint counters for the two wire paths (plain vs options-bearing), so a test can prove which path a caller took. A rejected options request still increments `with_options_calls`.
- **`with_errors(Vec<Option<String>>)`** — scripts failures by call position: each call consumes the front entry; `Some(message)` fails that one call (still counted and captured, like `with_error`), `None` or an exhausted script serves normally. This is how a test fails *exactly one* turn — for example, only the corrective retry of a prompted structured-output flow.

## `MockTool` — a tool with knobs

```rust
MockTool::new("flaky", "A flaky tool")
    .with_result("ok")              // what it returns
    .with_delay(Duration::from_millis(50))  // to test timeouts/parallelism
    .with_concurrency_safe(true)            // to test parallel dispatch
    .with_error()                   // fail with `result` as the error message
```

It ignores its input entirely (input-validation tests need a real tool — or a derived one) and exercises exactly the knobs dispatch behavior depends on: delay, concurrency flags, failure.

## Fixtures and the env guard

`test_config()` — a `SessionConfig` with a test system prompt; `test_message` / `test_assistant_message` / `test_tool_use_message` — message builders for lower-level tests.

`EnvGuard` — for tests that touch environment variables: it snapshots named variables, lets you set/remove them, and restores everything on drop (even mid-panic). It serializes across the test binary (parallel tests mutating env is UB-adjacent) and refuses nested guards.

## A complete test, start to finish

```rust
#[tokio::test]
async fn echoes_and_finishes() {
    let client = MockApiClient::new("m").with_responses(vec![/* script above */]);
    let mut tools = ToolRegistry::new();
    tools.register(MockTool::new("echo", "echo").with_result("echo: hi"));

    let mut agent = BareLoop::new(Arc::new(client), tools, test_config());
    let run = agent.run("go", &RunConfig::default()).await.unwrap();

    assert_eq!(run.turn_count(), 2);
    assert_eq!(run.tool_call_count(), 1);
    assert_eq!(run.output.as_deref(), Some("Done!"));
}
```

That is a full engine pass — loop, dispatch, feedback, finalize — deterministic and instant. The same script style drives the repo's own integration tests (`tests/`), which double as executable examples of expected behavior for every subsystem: compaction no-ops, fallback switching, parallel sibling-discard, redaction, MCP wiring, and more.

## What to test at which seam

| Seam | Tool |
|---|---|
| The full agent (loop, dispatch, termination) | `MockApiClient` + `MockTool` through `BareLoop::run` |
| One tool call in isolation | your `Tool::call` directly with a hand-built `ToolContext` |
| Middleware behavior | `ToolPipeline::invoke` with crafted contexts (see `tests/memoize_tool_call_id.rs`) |
| Compaction / fallback / detection | their managers directly — every subsystem is usable outside the engine |
| Real-model smoke tests | the repo's `make e2e` pattern: gated behind `LOOPCTL_E2E=1`, run on demand |

The last one is the project's own philosophy: everything deterministic is tested with mocks; a small gated suite proves the provider wiring against real endpoints (Ollama for the free tier).

---

## Gotchas

1. The mock **ignores request content** — it plays its script regardless of what you send. Tests of "the model should have seen X" belong to [observers](../04-extensions/01-observers.md) or the audit trail, not the mock.
2. Fixed usage numbers (50/25) leak into assertions — don't bake them into app logic.
3. `with_responses(vec![])` is a no-op (keeps the default script) — an easy silent mistake.
4. Derived tools make better test tools than `MockTool` when you care about input handling — the derive works in dev-dependencies like anywhere else.

## Related pages

- [API client](../01-core-data/03-api-client.md) — what the mock implements.
- [The repo's own tests](https://github.com/dch-labs/loopctl) — `tests/*.rs`, the best recipe book.
