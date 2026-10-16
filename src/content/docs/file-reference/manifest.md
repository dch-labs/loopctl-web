---
title: "src/manifest.rs and src/manifest/"
---

This file is a loop's declarative center, expressed as types, under the `manifest` feature. You parse a manifest document, deep-merge profiles, interpolate `${VAR}`, validate with span-bearing errors, export a JSON Schema, and hash the resolved shape.

There is no IO and no engine wiring here, so a host applies the result.

Submodules are `types.rs` for the document model, `merge.rs` for profile deep-merge, and `interpolate.rs` for env substitution.

`validate.rs` runs semantic checks, `schema.rs` exports the schemars shape, and `error.rs` holds your typed errors.

## Key items

`ManifestDocument::parse(text)` reads YAML into your typed `Manifest`, and shape errors come back as typed `ManifestError`s.

`ManifestDocument::resolve(env, profile)` does profile deep-merge plus `${VAR}` interpolation in one step and hands you a `ResolvedManifest`. Maps merge per-key, while sequences and scalars replace.

`EnvResolver`, `EnvVars`, and `EnvMap::from_pairs([...])` form your interpolation seam. The injectable `EnvMap` makes resolution, and therefore the hash, byte-reproducible for your tests.

`ResolvedManifest::manifest()`, `canonical_json()`, and `config_hash()` give you the resolved shape, its canonical form, and the stable identity a daemon or cache keys on.

The schema export in `manifest/schema.rs` gives editors and validators the authoritative shape of `loop.yaml` itself.

## Behavior notes

An unresolved `${VAR}` is a loud error naming the reference, never an empty string.

Your validation errors carry spans, so the message names the field and where it came from, base or which profile layer.

Deep dive: [The manifest](/integration/manifest/)
