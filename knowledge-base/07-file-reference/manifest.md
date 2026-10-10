# `src/manifest.rs` + `src/manifest/` — the `loop.yaml` model [feature: manifest]

A loop's declarative center, as types: parse a manifest document, deep-merge profiles, interpolate `${VAR}`, validate with span-bearing errors, export a JSON Schema, hash the resolved shape. No IO, no engine wiring — a host applies the result. Submodules: `types.rs` (the document model), `merge.rs` (profile deep-merge), `interpolate.rs` (env substitution), `validate.rs` (semantic checks), `schema.rs` (schemars export), `error.rs` (typed errors).

**Key items**

- `ManifestDocument::parse(text)` — YAML into the typed `Manifest`; shape errors are typed `ManifestError`s.
- `ManifestDocument::resolve(env, profile)` — profile deep-merge (maps merge per-key; sequences and scalars replace) plus `${VAR}` interpolation in one step → `ResolvedManifest`.
- `EnvResolver` / `EnvVars` / `EnvMap::from_pairs([...])` — the interpolation seam; the injectable `EnvMap` makes resolution (and the hash) byte-reproducible for tests.
- `ResolvedManifest::manifest()` / `canonical_json()` / `config_hash()` — the resolved shape, its canonical form, and the stable identity a daemon or cache keys on.
- The schema export (`manifest/schema.rs`) gives editors and validators the authoritative shape of `loop.yaml` itself.

**Behavior notes**

- An unresolved `${VAR}` is a loud error naming the reference — never an empty string.
- Validation errors carry spans: the message names the field and where it came from (base vs which profile layer).

Deep dive: [The manifest](../06-integration/06-manifest.md)
