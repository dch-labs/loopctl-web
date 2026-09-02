# `src/api.rs` — the `ApiClient` trait

The border between loopctl and every model provider. Object-safe; two required methods; options methods that fail loudly by default.

**Key items**

- `ApiClient` — required: `model()`, `stream_messages(&StreamRequest)`, `create_message(&StreamRequest)`. Provided: `set_model` (default `false`), `base_url` (default `""`), `stream_messages_with_options` / `create_message_with_options` (default: reject non-empty options), `extract_structured` (default: tool-call input, else lenient JSON from text).
- `StreamRequest { messages, system, tools }` + `new`/`with_system`/`with_tools`.
- `NonStreamingResponse { message, stop_reason, usage }`.
- Type aliases `BoxedApiClient`, `SharedApiClient`.

**Behavior notes**

- Streams must be `'static` — clone out of `&self`, never borrow it. (`create_message` futures may borrow: `+ '_`.)
- The fail-loud options defaults are deliberate: silently dropping a model override or a constraint would corrupt behavior invisibly.
- `base_url()` keys the rate limiter — custom clients that don't override it all share one bucket.

Deep dive: [API client](../01-core-data/03-api-client.md).
