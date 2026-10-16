---
title: "src/api.rs"
---

This file is the border between loopctl and every model provider you point it at. It is object-safe, needs two methods, and its options methods fail loudly by default.

## Key items

Your `ApiClient` requires `model()`, `stream_messages(&StreamRequest)`, and `create_message(&StreamRequest)`.

Provided methods carry defaults: `set_model` starts false, `base_url` starts empty, and `stream_messages_with_options` plus `create_message_with_options` reject non-empty options.

`extract_structured` defaults to tool-call input, else lenient JSON from text. `supports_tool_constraints` defaults to false, which gates the default strict-tool wiring.

`model_context_window` defaults to None, and you disclose the real window here. The OpenAI-compatible client answers from llama.cpp `/props` and Ollama `/api/show` (0.4.0).

`StreamRequest { messages, system, tools }` comes with `new`, `with_system`, and `with_tools`.

`NonStreamingResponse { message, stop_reason, usage }` is what a non-streaming call returns, and the aliases `BoxedApiClient` and `SharedApiClient` save you typing.

## Behavior notes

Your streams must be `'static`, so clone out of `&self` and never borrow it. `create_message` futures may borrow, carrying `+ '_`.

The fail-loud options defaults are deliberate. Silently dropping your model override or a constraint would corrupt behavior invisibly.

`base_url()` keys your rate limiter, so custom clients that do not override it all share one bucket.

Deep dive: [API client](/core-data/api-client/).
