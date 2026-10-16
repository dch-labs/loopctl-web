---
title: "src/reflection/llm.rs"
---

This file asks your model to analyze its own tool failures, and it is the first in-tree consumer of structured output. It is Opt-in. You pay one model round-trip per analyzed failure.

## Key items

You build an `LlmReflector::new(client)` and optionally `with_system_prompt(...)`.

The built-in analyst prompt specifies the exact `FailureAnalysis` JSON shape. It instructs the model to prefer `is_recoverable: false` over inventing corrections.

`analyze` builds one user message from Tool, Input, Schema, Error, Task, and Attempt lines. It omits the schema when that schema is unavailable and renders attempt 1-indexed.

Then it calls `request_structured::<FailureAnalysis>` and validates what came back.

`validate_modified_input`, under the `schema_validation` feature, rejects an `InputFix` whose `modified_input` fails the tool's real schema before you retry. Without the feature, corrections are trusted as-is.

## Behavior notes

Any reflector-side failure, meaning `ReflectionError::Internal`, becomes a conservative `Fail` in your engine.

The client is held as `Arc<dyn ApiClient>` so the boxed future can reach it without borrowing.

Cost one model call per failure analysis, and that is the reason this is not your default reflector.

Deep dive: [Reflection](/safety/reflection/).
