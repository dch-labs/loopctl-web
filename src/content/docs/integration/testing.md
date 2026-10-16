---
title: "Testing your agent"
sidebar:
  order: 5
---

Testing an agent against a live model is slow, flaky, and it costs you money. The `testing` feature in loopctl gives you a scripted fake model client and fake tools.

Your agent logic therefore runs end-to-end in milliseconds with zero network.

The source is `src/testing.rs`. Enable it in `[dev-dependencies]` with `loopctl = { features = ["testing"] }`.

## MockApiClient: a model with a script

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

Seven behaviors make it pleasant to work with:

- **Your script replays.** The last queued response repeats forever, so a run that
  overshoots its script never crashes your test.

- It emits the exact event sequence a real provider produces, which means message start,
  text deltas, tool-call deltas, and terminal events. Your streaming code paths get
  exercised for real.

- Usage comes back as a fixed 50 input and 25 output tokens, so your token-accounting
  assertions have something to bite.

- `set_model` works, so [`switch_model`](/engine/model-switch/) is testable, and a
  per-request model override is honored. The response names the routed model, so your
  fallback-routing tests can observe the routing.

- `with_error("...")` makes every call fail, which covers your provider-failure paths
  without a provider.

- `with_text_response("...")` is your one-liner for single-turn tests.

- A `response_format` request is served with the canned text as-is, because the mock
  cannot enforce a schema when it has no model. That is exactly what your
  structured-output parse-failure tests need: feed it prose and watch your error handling
  work.
- A `tool_constraint` is rejected loudly, because it shapes the tool-calling path that the
  mock scripts, and a clear error beats a lie.

### The mock's stream, event by event

This is exactly what `stream_messages` yields for one canned response:

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

Two details are deliberate:

- Your text arrives as a single delta, with no artificial chunking. If your test needs
  multi-fragment assembly, that is accumulator territory, and the crate's own tests cover
  it.
- The tool lane opens with an empty input and then streams its arguments, which mirrors
  how real providers deliver tool calls piecemeal. Your accumulated tool input is
  therefore byte-identical on the mock and the real path.

The non-streaming twin builds the same parts in the same lane order, text first and then the tool call.

## The wire, recorded

The mock also remembers what reached it, so your tests can pin the exact request shape rather than the outcome alone:

- **`captured_requests()`** returns clones of every served `create_message` request,
  oldest first. A request rejected before sending, such as one with unsupported options,
  is never captured, because it never reached the wire.

- **`captured_stream_requests()`** arrived in 0.4.0 and gives you the same record for the
  streaming path: every request the mock served on `stream_messages`.

- **`create_message_calls()` and `with_options_calls()`** are counters for the two wire
  paths, so a test can prove which path your caller took. The options counter, added in
  0.4.0, covers both options-bearing transports, meaning `create_message_with_options` and
  `stream_messages_with_options`, and a rejected options request still increments it.

- **`without_usage()`**, new in 0.4.0, serves your script with no usage payload at all,
  which is the shape of a backend that reports no usage.
- Your fixtures can then assert identity behavior on the engine's estimate side, with no
  calibration and no anchor. The fixed 50 and 25 default report stays otherwise.

- **`with_errors(Vec<Option<String>>)`** scripts failures by call position. Each call
  consumes the front entry, a `Some(message)` fails that one call while still being
  counted and captured as `with_error` does, and a `None` or an exhausted script serves
  normally.
- This is how you fail exactly one turn, such as only the corrective retry of a prompted
  structured-output flow.

## MockTool: a tool with knobs

```rust
MockTool::new("flaky", "A flaky tool")
    .with_result("ok")              // what it returns
    .with_delay(Duration::from_millis(50))  // to test timeouts/parallelism
    .with_concurrency_safe(true)            // to test parallel dispatch
    .with_error()                   // fail with `result` as the error message
```

It ignores its input entirely, so an input-validation test needs a real tool or one you derived. What it does exercise is exactly the set that dispatch behavior depends on: delay, concurrency flags, and failure.

## Fixtures and the env guard

`test_config()` hands you a `SessionConfig` with a test system prompt. `test_message`, `test_assistant_message`, and `test_tool_use_message` are your message builders for lower-level tests.

`EnvGuard` is for tests that touch environment variables. It snapshots the named variables, lets you set and remove them, and restores everything on drop, even mid-panic.

It also serializes across the test binary, because parallel tests mutating your environment is UB-adjacent, and it refuses nested guards.

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

That is a full engine pass covering loop, dispatch, feedback, and finalize, and it runs deterministically and instantly.

The same script style drives the repo's own integration tests in `tests/`. Those tests double as executable examples of expected behavior for every subsystem: compaction no-ops, fallback switching, parallel sibling-discard, redaction, MCP wiring, and more.

## What to test at which seam

| Seam | Tool |
|---|---|
| Your full agent, meaning loop, dispatch, and termination | `MockApiClient` plus `MockTool` through `BareLoop::run` |
| One tool call in isolation | Your `Tool::call` directly with a hand-built `ToolContext` |
| Middleware behavior | `ToolPipeline::invoke` with crafted contexts, as in `tests/memoize_tool_call_id.rs` |
| Compaction, fallback, and detection | Their managers directly, because every subsystem is usable outside the engine |
| Real-model smoke tests | The repo's `make e2e` pattern, gated behind `LOOPCTL_E2E=1` and run on demand |

That last row is the project's own philosophy. Everything deterministic is tested with mocks, and a small gated suite proves the provider wiring against real endpoints, with Ollama covering the free tier.

## Two oracles beyond the mock

Two harnesses from 0.4.0 pin the repo's own wire contracts, and you can use both from your own projects.

### Cassettes: the wire is the oracle

A cassette is a real HTTP exchange. You record it through a forwarding proxy during a deliberate live session, and then you scrub it so credentials never enter the file.

Scrubbing turns provider-generated ids into deterministic placeholders consistently across the file, and the result replays hermetically.

Replay matching is exact on method, path, recorded query pairs, headers, and full body bytes. A request your client builds differently than the real server accepted misses every mock and fails as a 404. Replays also require the provider's contract headers to be present, though never at a specific value.

The doctrine is that you never weaken a cassette to make it pass. A red replay is the finding, which means either your client drifted or the provider drifted and needs a deliberate re-record. A `committed_cassettes_carry_no_secrets` meta-test scans the corpus on every run and fails closed.

### Goldens: the engine is the oracle

Cassettes guard provider-shape truth, and golden request bytes guard engine-construction truth.

Deterministic fixtures run through `BareLoop` against a recording mock that captures the exact request-and-options pair of every outbound call. Canonical-JSON snapshots land in `tests/golden/`, one file per scenario.

Object key order is never a contract, and array order is pinned, which covers your message order and your tool schema order in registration order. A red golden can only mean your construction drifted, and there is no re-record to hide behind.

Regeneration is a deliberate, reviewed act. Run `UPDATE_GOLDENS=1 cargo test --test golden_requests`, then read the diff like code.

Both live in the crate's `tests/` under `cassettes/` and `golden/`, and `TESTING.md` in the repository carries the full doctrine.

## Gotchas

1. The mock ignores request content, because it plays its script regardless of what you
  send. Tests of "the model should have seen X" belong to
  [observers](/extensions/observers/) or the audit trail rather than to the mock.

2. The fixed usage numbers of 50 and 25 leak into your assertions, so do not bake them into
  app logic.

3. `with_responses(vec![])` is a no-op that keeps the default script, which is an easy
  silent mistake.

4. Derived tools make better test tools than `MockTool` when you care about input handling,
  and the derive works in dev-dependencies like anywhere else.

## Related pages

- [API client](/core-data/api-client/) covers what the mock implements.
- [The repo's own tests](https://github.com/dch-labs/loopctl) are `tests/*.rs`, and they
  are the best recipe book.
