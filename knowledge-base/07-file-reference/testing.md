# `src/testing.rs` — the mock toolkit [feature: testing]

Fakes for every moving part, so agent logic runs end-to-end with zero network. Compiled only under the feature — no production impact.

**Key items**

- `MockApiClient` — scripted model: `new(model)`, `with_responses(vec![...])`, `with_text_response`, `with_tool_call`, `with_stop_reason`, `with_error`, **`without_usage()`** (0.4.0 — serve the script with no usage payload, the no-usage backend shape). Emits the real provider event sequence; usage fixed 50/25; last script entry repeats forever; `set_model` works (model-switch tests); `response_format` served with the canned text (parse-failure tests); `tool_constraint` rejected loudly.
- Wire recording: `captured_requests()` / **`captured_stream_requests()`** (0.4.0) / `create_message_calls()` / `with_options_calls()` (counts both options-bearing transports since 0.4.0) / `with_errors(Vec<Option<String>>)` (per-position failure scripting).
- `MockResponse { text, tool_call, stop_reason }`, `MockToolCall { id, name, input }` — the script shapes.
- `MockTool` — knobs for dispatch behavior: `with_result`, `with_error`, `with_delay`, `with_concurrency_safe`, `with_read_only`, `with_schema`. Ignores its input.
- Fixtures: `test_config()`, `test_message`, `test_assistant_message`, `test_tool_use_message`.
- `EnvGuard` — snapshot/set/restore environment variables across a test, serialized between tests, restores even on panic.

**Behavior notes**

- The mock ignores request content entirely — "the model should have seen X" assertions belong to observers or the audit trail.
- `with_responses(vec![])` is a no-op (keeps the default script).
- Beyond the mock, the repo pins its wire contracts two more ways (both in `tests/`): the **cassette corpus** (`cassettes/` — recorded real exchanges, replayed hermetically, never weakened) and **golden request bytes** (`golden/` — canonical-JSON snapshots of engine-constructed requests, regenerated only via `UPDATE_GOLDENS=1`).

Deep dive: [Testing](../06-integration/05-testing.md).
