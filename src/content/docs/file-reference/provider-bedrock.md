---
title: "`src/provider/bedrock.rs` — `BedrockClient` [feature: bedrock]"
---


The AWS client: SigV4-signed requests, two wire paths, binary event-stream decoding. (~3,550 lines with tests.)

**Key items**

- `from_env()` (AWS_REGION / ACCESS_KEY_ID / SECRET_ACCESS_KEY, optional SESSION_TOKEN, AWS_BEDROCK_MODEL) + validating builder; `set_credentials(...)` for atomic triple rotation.
- `BedrockPath { Anthropic, Converse }` — auto-selected per model id (`anthropic.*` prefix), pinnable; URLs with percent-encoded model ids (the exact encoded path is signed).
- SigV4: `sigv4_sign(...)` — canonical request, HMAC key chain, headers; pinned against AWS's documented vectors.
- `AwsEventStreamDecoder` — the incremental binary frame parser (length-prefixed frames, typed headers, exception frames flagged).
- Converse mapping: `toolUse`/`toolResult` blocks (with `status: success|error` — `is_error` travels), `toolConfig.toolSpec`, `inferenceConfig.maxTokens`.

**Behavior notes**

- Streaming: the Anthropic path feeds the shared Anthropic emitter; the Converse path has its own emitter whose terminal pair (stop + usage) comes from the final `metadata` frame, emitted exactly once.
- Non-streaming responses are plain JSON in either shape; an unrecognized shape is an explicit error.
- **No `RequestOptions` support** (base methods only) and HTTP errors aren't auto-classified into rate-limit/auth forms.
- `max_tokens` defaults 8192; models with lower own caps reject bigger budgets — configure per client.

Deep dive: [Bedrock](/providers/bedrock/).
