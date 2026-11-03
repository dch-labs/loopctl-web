---
title: "src/api/probe.rs"
---

This file holds the model-probe value types: what `list_models`, `ping`, and `model_metadata` answer with, and how a probe failure classifies. All types are `#[non_exhaustive]` and constructor-built, so you extend your records through the builders.

## Key items

`ModelInfo` carries the usable id, a display name, verbatim creation stamps, `owned_by`, and a weight size. You build it through `new` and the `with_*` builders.

`ModelMetadata` carries `context_window`, input and output `modalities`, and `ModelCapabilities` of `structured_output` and `tool_calling`. `MetadataSource` marks every fact `Unreported`, `Curated`, `Disclosed`, or `DisclosedAndCurated`.

`PingReport` carries measured latency plus the answer's rate-limit snapshot and request id. `ProbeClass` is the failure vocabulary: `Auth`, `RateLimited`, `Server`, `Answered`, `Network`, `Unsupported`, `Other`.

`curated_model_metadata(model)` reads the crate's small curated table, and `Modality::from_wire_token` maps a provider's token.

## Behavior notes

A record that states a fact without labeling its source is promoted by both the builders and deserialization, so provenance cannot go missing on you.

An undocumented id answers fully `Unreported`, never a plausible zero. The curated table reads `None` for unverified claims and reserves `Some(false)` for documented refusals.

`ProbeClass::from_error` derives mechanically from the variant and status, including 429, 503, and 529 riding a plain `Http` failure. When you classify an error of your own, use the same function your conformance harness reads.

For the deep dive, see [Model probes](/providers/probes/).
