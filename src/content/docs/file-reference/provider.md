---
title: "`src/provider.rs` — profiles and shared plumbing [feature: providers]"
---


The module map, the one-function profiles, and every piece of HTTP plumbing the clients share.

**Key items — profiles**

`ollama(model)`, `deepseek()`, `grok()`, `azure(resource)`, `moonshot()`, `zai()`, `self_hosted(url, model)` — env vars, base URLs, and default models tabulated on [the overview page](/providers/overview/).

**Key items — shared plumbing**

- `HttpClientConfig` — read timeout 120s (a gap timeout, not a total cap), connect 10s, pool tuning, `tcp_nodelay` on (SSE), injectable `reqwest::Client`.
- `post_json_checked(...)` — the single HTTP-error construction site: reads `Retry-After` while the response is in hand, caps error bodies at 8 KB, classifies (401 invalid-key / 403 auth / 429-503-529 rate-limited / else http).
- `read_bounded_body` (10 MB cap) — non-streaming response reading.
- `fold_system_messages(messages, system)` — pull inline system messages out, merge with the configured prompt (caller first, folded appended).
- `sse_data_payload` / `sse_event_type` — the one-optional-space field parsers.

**Behavior notes**

- `azure()` validates the resource name before touching env vars; only the v1 API surface is supported.
- Body minimality everywhere: empty tool lists are omitted (never `[]`), oversized bodies refused early.

Deep dive: [Providers overview](/providers/overview/).
