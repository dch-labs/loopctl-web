# `src/provider/forensics.rs`

This file captures wire forensics: request ids and rate-limit headers pulled from the response the failure arrived on. It feeds `ProviderMeta` in `ApiError` and `last_rate_limit` on the chat clients.

## Key items

`REQUEST_ID_HEADERS` is the ordered id list: `x-amzn-requestid`, `x-request-id`, `openai-request-id`, `apiproxy-id`, `cf-ray`, and friends. The first present wins.

`RATE_LIMIT_LIMIT_HEADERS`, `RATE_LIMIT_REMAINING_HEADERS`, and `RATE_LIMIT_RESET_HEADERS` cover both the `x-ratelimit-*` and `rate-limit-*` spellings.

Capture helpers bound values at `MAX_REQUEST_ID_CHARS` and `MAX_RATE_LIMIT_VALUE_CHARS`, on char boundaries, so a hostile header cannot balloon memory or split a code point.

## Behavior notes

The snapshot stores verbatim strings. Units differ per provider, tokens versus requests, epoch versus HTTP date, and interpretation is the consumer's job.

Capture happens once, at HTTP time, in the shared checked-transport path. Bedrock threads it through its own paths, where an exception frame's id outranks the response-level id.

The low-water line warns once per window when a response reports under 10% remaining, at WARN, latched and re-armed by recovery or silence.

For the deep dive, see [Wire forensics](../05-providers/10-forensics.md).
