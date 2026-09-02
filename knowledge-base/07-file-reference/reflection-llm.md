# `src/reflection/llm.rs` — the model-powered reflector

Asks the model to analyze its own tool failures — the first in-tree consumer of structured output. Opt-in; one model round-trip per analyzed failure.

**Key items**

- `LlmReflector::new(client)` + `with_system_prompt(...)` — the built-in analyst prompt specifies the exact `FailureAnalysis` JSON shape and instructs the model to prefer `is_recoverable: false` over inventing corrections.
- `analyze` — builds one user message (Tool / Input / Schema / Error / Task / Attempt lines; schema omitted when unavailable; attempt rendered 1-indexed), calls `request_structured::<FailureAnalysis>`, validates.
- `validate_modified_input` [feature: schema_validation] — rejects an `InputFix` whose `modified_input` fails the tool's real schema **before** the retry; without the feature, corrections are trusted as-is.

**Behavior notes**

- Any reflector-side failure (`ReflectionError::Internal`) becomes a conservative `Fail` in the engine.
- The client is held as `Arc<dyn ApiClient>` so the boxed future can reach it without borrowing.
- Cost model: one model call per failure analysis — the reason it isn't the default.

Deep dive: [Reflection](../03-safety/05-reflection.md).
