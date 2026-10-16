---
title: "src/provider/gemini.rs"
---

This file is your Google Gemini client, `GeminiClient`, and it runs about 3,720 lines with tests. You reach it under the `gemini` feature.

## Key items

You build a client with `from_env()`, which reads `GEMINI_API_KEY` or `GOOGLE_API_KEY`, or with the builder, where `with_include_thoughts` starts false.

Gemini puts the model in the path, so you call `:streamGenerateContent?alt=sse` or `:generateContent`. Your API key rides the `x-goog-api-key` header and never one of those URLs.

The client folds your system prompt into `systemInstruction`, because the API rejects an inline system role and omits the field entirely when it is empty.

`generationConfig` carries your choices. You treat `thinkingConfig.includeThoughts` as an opt-in, and/or you set `responseMimeType` plus `responseJsonSchema` for formats.

The default for thoughts is off, which keeps your replies lean until you ask for reasoning.

The emitter synthesizes `MessageStart`, since Gemini chunks carry no ids. It latches usage from the latest non-empty `usageMetadata` and counts thoughts into your output.

A chunk with `finishReason` becomes your terminal event, and it fires once, so a proxy that re-emits cannot fake a second end.

## Behavior notes

`include_thoughts(true)` on a non-reasoning model earns you a 400, so match the flag to the model you pick. Parsing still routes `thought: true` parts to your thinking lane even when you leave the flag at its default of false.

Gemini delivers tool calls complete rather than fragmented: open, one JSON delta, close. Your downstream sees the standard shape.

Errors map on status. Codes 429, 503 and 529, or the statuses `RESOURCE_EXHAUSTED` and `UNAVAILABLE`, become your rate limit.

Everything else becomes an API error. `MAX_TOKENS` becomes `MaxTokens`, and every other finish reason, `SAFETY` included, becomes `EndTurn` for you.

Deep dive: [Gemini](/providers/gemini/).
