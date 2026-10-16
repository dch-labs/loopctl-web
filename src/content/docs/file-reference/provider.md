---
title: "src/provider.rs"
---

This file is your module map under the `providers` feature: the one-function profiles, and every piece of HTTP plumbing the clients share.

## Key items, profiles

`ollama(model)`, `deepseek()`, `grok()`, `azure(resource)`, `moonshot()`, `zai()`, and `self_hosted(url, model)` give you env vars, base URLs, and default models. [The overview page](/providers/overview/) tabulates them.

## Key items, shared plumbing

`HttpClientConfig` sets a read timeout of 120s, which is a gap timeout rather than a total cap.

It also covers connect at 10s, pool tuning, `tcp_nodelay` on for SSE, and an injectable `reqwest::Client` you can supply.

`post_json_checked(...)` is your single HTTP-error construction site. It reads `Retry-After` while the response is in hand, caps error bodies at 8 KB, and classifies: 401 invalid-key, 403 auth, 429 or 503 or 529 rate-limited, else http.

`read_bounded_body` handles non-streaming response reading and enforces a 10 MB cap.

`fold_system_messages(messages, system)` pulls inline system messages out and merges them with your configured prompt, caller first, folded appended.

`sse_data_payload` and `sse_event_type` are your one-optional-space field parsers.

## Behavior notes

`azure()` validates your resource name before it touches env vars, and only the v1 API surface is supported.

Bodies stay minimal everywhere: empty tool lists are omitted rather than sent as `[]`, and oversized bodies are refused early.

Deep dive: [Providers overview](/providers/overview/).
