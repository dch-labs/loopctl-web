---
title: "src/provider/sse.rs"
---

This file is your shared line-level parser for Server-Sent Events, under the `providers` feature. The OpenAI, Anthropic, and Gemini clients all read through it, so you decode here once instead of three times.

## Key items

You wrap a response with `SseReader::from_response(resp)`, which takes over the response's byte stream.

Buffering is byte-oriented, because TCP chunks ignore character boundaries. `take_line` decodes complete lines only, so invalid UTF-8 on a complete line is an error, and it trims `\r` for CRLF wires.

A 1 MiB per-line cap protects you: an endless line is a protocol error, not unbounded memory.

`[DONE]` sentinel tracking covers the OpenAI family, while provider-specific extractors live in each client as `next_openai_data`, `next_event`, and `next_gemini_data`.

## Behavior notes

Comment lines with a leading `:` are skipped, which is how your keep-alives get handled.

So the reader consumes bytes, splits them into lines, and returns each complete line to whoever asked. It never retries, sleeps, or reconnects, and it does not decide when you give up.

Treat this layer as a parser, not a reconnector. A dead stream ends without a terminal event, and retry decisions belong to your `StreamHandler`.

The distinction it upholds: "server said done" means a sentinel or terminal event was seen, while "connection died" means absence of terminal. Your engine's truncation detection depends on that split.

Deep dive: [SSE](/providers/sse/).
