---
title: "src/provider/bedrock.rs"
---

This file gives you `BedrockClient`, the AWS client under the `bedrock` feature: SigV4-signed requests, two wire paths, and binary event-stream decoding. It runs about 3,550 lines with tests.

## Key items

`from_env()` reads AWS_REGION, ACCESS_KEY_ID, and SECRET_ACCESS_KEY, plus an optional SESSION_TOKEN and AWS_BEDROCK_MODEL, then hands you a validating builder. Use `set_credentials(...)` for atomic triple rotation mid-run.

`BedrockPath { Anthropic, Converse }` is auto-selected per model id from the `anthropic.*` prefix, and you can pin it. Your URLs carry percent-encoded model ids, because the exact encoded path is signed.

`sigv4_sign(...)` builds your canonical request, HMAC key chain, and headers. AWS's documented vectors pin it.

`AwsEventStreamDecoder` is your incremental binary frame parser: length-prefixed frames, typed headers, and exception frames flagged.

Converse mapping covers `toolUse` and `toolResult` blocks, where `status: success|error` carries `is_error`, plus `toolConfig.toolSpec` and `inferenceConfig.maxTokens`.

## Behavior notes

Streaming splits by path. Your Anthropic path feeds the shared Anthropic emitter.

The Converse path has its own emitter, and its terminal pair of stop plus usage comes from the final `metadata` frame. That pair is emitted exactly once.

Since 0.4.0 Converse's `cacheReadInputTokens` fills `Usage::cached_input_tokens`, and Anthropic-shape responses get the direct client's input normalization of raw plus cache reads plus creation.

Non-streaming responses are plain JSON in either shape, and an unrecognized shape is an explicit error.

There is no `RequestOptions` support, so you get base methods only, and HTTP errors are not auto-classified into rate-limit or auth forms.

`max_tokens` defaults to 8192, and models with lower own caps reject bigger budgets, so configure per client.

Deep dive: [Bedrock](/providers/bedrock/).
