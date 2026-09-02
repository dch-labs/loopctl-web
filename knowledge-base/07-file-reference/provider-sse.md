# `src/provider/sse.rs` — the SSE reader [feature: providers]

The shared line-level parser for Server-Sent Events, used by the OpenAI/Anthropic/Gemini clients.

**Key items**

- `SseReader::from_response(resp)` — wraps the response's byte stream.
- Byte-oriented buffering (TCP chunks ignore character boundaries); `take_line` decodes complete lines only (invalid UTF-8 on a complete line = error); trims `\r` for CRLF wires.
- 1 MiB per-line cap — an endless line is a protocol error, not unbounded memory.
- `[DONE]` sentinel tracking (OpenAI family); provider-specific extractors live in each client (`next_openai_data`, `next_event`, `next_gemini_data`).

**Behavior notes**

- Comment lines (leading `:`) are skipped — that's keep-alives handled.
- This layer is a parser, **not** a reconnector: a dead stream just ends without a terminal event; retry decisions belong to the `StreamHandler`.
- The distinction it upholds: "server said done" (sentinel / terminal event seen) vs "connection died" (absence of terminal) — the engine's truncation detection depends on it.

Deep dive: [SSE](../05-providers/06-sse.md).
