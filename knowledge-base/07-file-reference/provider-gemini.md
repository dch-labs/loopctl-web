# `src/provider/gemini.rs` — `GeminiClient` [feature: gemini]

The Google Gemini client. (~3,720 lines with tests.)

**Key items**

- `from_env()` (GEMINI_API_KEY / GOOGLE_API_KEY) + builder including `with_include_thoughts(false default)`.
- Model-in-path URLs (`:streamGenerateContent?alt=sse` / `:generateContent`); key in the `x-goog-api-key` header, never the URL.
- System folding into `systemInstruction` (inline system rejected by the API — omitted entirely when empty).
- `generationConfig` — `thinkingConfig.includeThoughts` (opt-in) and/or `responseMimeType` + `responseJsonSchema` for formats.
- The emitter: synthesized `MessageStart` (Gemini chunks carry no ids), usage latched from the latest non-empty `usageMetadata` (thoughts counted into output), terminal = a chunk with `finishReason`, emitted once (proxy re-emits guarded).

**Behavior notes**

- `include_thoughts(true)` on a non-reasoning model = 400; match the flag to the model. Parsing routes `thought: true` parts to the thinking lane regardless of the flag.
- Tool calls arrive complete (not fragmented): open → one JSON delta → close, so downstream sees the standard shape.
- Errors: code 429/503/529 or status RESOURCE_EXHAUSTED/UNAVAILABLE → rate limit; else API error. `MAX_TOKENS` → MaxTokens; everything else (incl. SAFETY) → EndTurn.

Deep dive: [Gemini](../05-providers/04-gemini.md).
