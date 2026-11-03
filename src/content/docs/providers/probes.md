---
title: "Model probes"
sidebar:
  order: 9
---

Before the first turn, you can ask a client three questions: which models does it serve, is it alive, and what can a model do. Three `ApiClient` trait methods answer them for you.

All three have working defaults, so every client is probeable and your own impls compile unchanged. Source: `src/api.rs` and `src/api/probe.rs`.

Added in 0.5.0.

## The three verbs

| Method | Answers | Default |
|---|---|---|
| `list_models()` | What the endpoint serves, as `Vec<ModelInfo>` | Refuses with a fixed message |
| `ping()` | Liveness, as a `PingReport` with measured latency | Sends one minimal completion |
| `model_metadata(model)` | Window, modalities, capabilities, provenance | Curation only, no endpoint call |

Read the `ping` default's cost before you probe a metered endpoint on your own client. One completion is one bill, and the method's docs say so. The four shipped clients all answer on a metadata route instead, so you ping them for nothing.

## ProbeClass

Every probe failure lands in one vocabulary, `ProbeClass`:

| Class | Meaning |
|---|---|
| `Auth` | Credential refused |
| `RateLimited` | Throttled, including 429, 503, and 529 riding a plain `Http` failure |
| `Server` | The endpoint's own failure |
| `Answered` | The endpoint answered and refused the route |
| `Network` | Transport failure, never a credential problem |
| `Unsupported` | This client cannot probe |
| `Other` | Anything else, including a 200 with no models in any accepted spelling |

`ProbeClass::from_error` derives the class mechanically from the variant and status the wire already chose. When your endpoint never answers, it can never read as a credential problem.

## What a listing tells you

`ModelInfo` carries the usable id, a display name, verbatim creation stamps, `owned_by`, and a weight size. The stamps are verbatim on purpose: providers disagree on units, and the crate does not guess them.

Listings answer the endpoint's first page. Anthropic's `has_more`, Gemini's `nextPageToken`, and Bedrock's `nextToken` continuations are documented page-one-only, with no result flag. The bound is the contract. A failure is never a short list, and an empty catalog only an empty array can express.

## Metadata with provenance

`model_metadata(model)` is the single funnel over provider disclosures and a small curated table. It returns a `ModelMetadata`: `context_window`, input and output `modalities`, and `ModelCapabilities` of `structured_output` and `tool_calling`.

Every fact carries a `MetadataSource` marker, because a number the provider served and a published opinion are different kinds of fact:

| Marker | Meaning |
|---|---|
| `Unreported` | Nobody said |
| `Curated` | The crate's table only |
| `Disclosed` | The endpoint only |
| `DisclosedAndCurated` | Both agree |

Provider disclosures beat curation field by field. Gemini's listing folds its disclosed `inputTokenLimit` in, and a llama.cpp or Ollama deployment you run discloses its own window through the same funnel behind `model_context_window`. An id nobody documented answers fully `Unreported`, never a plausible zero.

The curated table holds back where the record is thin. An unverified claim reads `None`, not `false`. A documented refusal reads `Some(false)`, and only two stand today: the Messages family has no native JSON-schema mode, and the DeepSeek reasoning endpoint has no tool support.

## Per-provider routes

| Client | Listing route | Notes |
|---|---|---|
| OpenAI-compatible | `GET {base}/models` | A genuine 404 falls back to Ollama's `GET /api/tags`, surfacing the original refusal when both fail |
| Anthropic | `GET /v1/models` | Sent with the credential pair |
| Gemini | `GET /models` | Folds each entry's disclosed input-token limit |
| Bedrock | SigV4-signed `GET /foundation-models` | Control-plane catalog truth, not account entitlement; resolves provider-prefixed ids |

`ping` shares the route set, so a tags-only Ollama server you run pings as live rather than reading as a wrong URL.

Probe GETs ride a shared checked-transport helper with a 5-second total deadline, so a dead metadata route cannot stall on the conversational timeout. A probe rejection you get carries the same request-id forensics a completion failure carries.

## Fixtures

`MockApiClient::with_models(models)` stages a listing for your tests. Unscripted, the mock refuses with the trait default's message, so probe error paths you exercise run identically against mock and reality.

## Related pages

- [The API client](/core-data/api-client/): the trait these verbs joined.
- [Wire forensics](/providers/forensics/): what rides a probe failure.
- [Context accounting](/engine/context-accounting/): where a disclosed window lands.
- [File reference: api/probe.rs](/file-reference/api-probe/)
