---
title: "src/testing.rs"
---

This file ships fakes for every moving part under the `testing` feature, so your agent logic runs end-to-end with zero network. It compiles only under the feature, so you carry no production impact.

## Key items

`MockApiClient` is your scripted model: `new(model)`, `with_responses(vec![...])`, `with_text_response`, `with_tool_call`, `with_stop_reason`, and `with_error`.

`without_usage()` is new in 0.4.0 and serves the script with no usage payload, which gives you the no-usage backend shape.

It emits the real provider event sequence with usage fixed at 50/25, and the last script entry repeats forever.

`set_model` works, which your model-switch tests rely on, and `response_format` is served with the canned text for parse-failure tests. A `tool_constraint` is rejected loudly.

Wire recording gives you `captured_requests()`, `captured_stream_requests()` from 0.4.0, and `create_message_calls()`.

`with_options_calls()` counts both options-bearing transports since 0.4.0, and `with_errors(Vec<Option<String>>)` scripts failures per position.

`MockResponse { text, tool_call, stop_reason }` and `MockToolCall { id, name, input }` are your script shapes.

`MockTool` carries knobs for dispatch behavior: `with_result`, `with_error`, `with_delay`, `with_concurrency_safe`, `with_read_only`, and `with_schema`. It ignores its input.

Your fixtures are `test_config()`, `test_message`, `test_assistant_message`, and `test_tool_use_message`.

`EnvGuard` snapshots, sets, and restores environment variables across a test, serializes between tests, and restores even on panic.

## Behavior notes

The mock ignores request content entirely, so "the model should have seen X" assertions belong to observers or the audit trail.

`with_responses(vec![])` is a no-op and keeps the default script.

Beyond the mock, your repo pins wire contracts two more ways, both in `tests/`: the cassette corpus in `cassettes/`, which replays recorded real exchanges hermetically and is never weakened.

The second is golden request bytes in `golden/`, canonical-JSON snapshots of engine-constructed requests, regenerated only via `UPDATE_GOLDENS=1`.

Deep dive: [Testing](/integration/testing/).
