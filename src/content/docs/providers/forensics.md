---
title: "Wire forensics"
sidebar:
  order: 10
---

When a provider 429s or 500s, your diagnosis needs two things the status line arrives with: the request id and the rate-limit state. The crate captures both at HTTP time and rides them on the typed errors you match and the clients you hold. Source: `src/provider/forensics.rs` and `src/api/error.rs`.

Added in 0.5.0.

## What gets captured

`ProviderMeta` holds:

- `request_id`, the first present of `x-amzn-requestid`, `x-request-id`, `openai-request-id`, `apiproxy-id`, `cf-ray`, and friends.
- A `RateLimitSnapshot` of the `x-ratelimit-*` and `rate-limit-*` family, as verbatim strings.

The snapshot is never interpreted. Units are per-provider, tokens versus requests, epoch versus HTTP date, and normalizing them here would be guesswork. The values are bounded at capture on char boundaries.

## Reading it

Read forensics through one accessor, `ApiError::provider_meta()`. The `Display` text appends ` [req <id>]` only when an id was captured, so every pre-existing error string is byte-unchanged.

```rust
match result {
    Err(err) => {
        if let Some(meta) = err.provider_meta() {
            if let Some(id) = meta.request_id.as_deref() {
                eprintln!("provider request {id} failed");
            }
        }
    }
    Ok(reply) => { /* ... */ }
}
```

The snapshot itself is three verbatim `Option<String>` fields, `limit`, `remaining`, and `reset`. Keep the strings and parse them where the provider is known.

Check the accessor before you parse error text. The suffix is for humans, and the typed accessor is for your tooling.

## Where capture happens

Capture happens once, at HTTP time, in the shared `post_json_checked` path. Every OpenAI-compatible, Anthropic, and Gemini client you run inherits it, embeddings included.

Three corners have their own rules. On Bedrock, an exception frame carrying its own `x-amzn-requestid` outranks the response-level id, because that id names the frame that actually failed.

Mid-stream failures name their request too. The id captured when the stream opened rides the error a mid-stream error frame, a chunk-parse failure, a dropped connection, or a provider `error` event at stream end produces.

A 2xx response that fails the body read or the JSON parse keeps the meta as well, because the error was built after the response was consumed.

## The success path

A 429's neighbor is a 200 with three remaining. The four chat clients expose `last_rate_limit() -> Option<RateLimitSnapshot>`, refreshed per response you serve, failures included, because a throttle's `remaining: 0` is exactly the state worth keeping.

Three rules govern what you read:

- Per-response, not sticky. The next silent response clears it.
- Last-writer-wins. One acquisition swaps one response's snapshot whole, so you never see one response's `remaining` beside another's `limit`.
- `None` means unreported, never zero. Local servers you run send none of these headers and change nothing.

## Telemetry and the low-water line

Wire failures narrate one metric event with `status`, `class`, and the request id, on the `provider.wire_failures` row. A response reporting under 10% remaining warns once per window at WARN, latched and re-armed by recovery or silence. The per-response state event stays at DEBUG.

Forensics is pure observability. No classification, retry, or rate-limit decision consults it, so acting on `remaining` stays your call. The 8 KiB diagnostic-body bound still truncates with meta attached, and the meta is not a size loophole you can hit.

## Migration

The wire-failure variants changed shape in 0.5.0. `Api`, `Auth`, and `Http` gained a second tuple element, `Option<Box<ProviderMeta>>`, and `RateLimit` is now `#[non_exhaustive]` with a `meta` field.

In-crate patterns bind the new element with `..`. Your external construction should go through the constructors, `ApiError::api(msg)`, `ApiError::auth(msg)`, `ApiError::http(msg)`, which build the meta-free shape. Matches you write against these variants need `..` in the pattern.

## Related pages

- [Errors](/core-data/errors/): the `LoopError` layer above these.
- [Model probes](/providers/probes/): probes carry the same forensics.
- [Run metrics](/telemetry/metrics/): the rows these events feed.
- [File reference: provider/forensics.rs](/file-reference/provider-forensics/)
