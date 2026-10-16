---
title: "Embeddings"
sidebar:
  order: 8
---

Semantic memory needs real embeddings, which means text turned into vectors positioned so that similar meanings sit close together. The [`vector_index`](/extensions/memory/) feature defines the traits, and this page covers the two real `EmbeddingProvider` backends that turn that substrate into working semantic retrieval. The source is `src/provider/embeddings.rs`.

Both backends live behind the provider feature you already know, `ollama` or `openai`, plus `vector_index`. There are no new features, and `default = []` is untouched.

## OllamaEmbedder: local and key-free

This one speaks Ollama's native embedding endpoint at `{OLLAMA_BASE_URL}/api/embed`. A chat-profile `/v1` suffix is normalized away, so both profiles share the same variable.

The legacy singular-input `/api/embeddings` route is deliberately unused, because it has no batching and is deprecated upstream.

```rust
use loopctl::provider::embeddings::OllamaEmbedder;

let embedder = OllamaEmbedder::from_env()?;   // OLLAMA_EMBEDDING_MODEL (required)
                                             // OLLAMA_BASE_URL (default localhost:11434)
                                             // OLLAMA_EMBEDDING_DIM (optional pin)
// or: OllamaEmbedder::builder().with_model("nomic-embed-text").with_dim(768).build()?
```

Three behaviors are worth knowing:

- Your default is `nomic-embed-text` at 768 dimensions, and you need no API key.
- `from_env` requires `OLLAMA_EMBEDDING_MODEL` and deliberately refuses `OLLAMA_MODEL`, which is your chat model. The two can never be silently conflated in your configuration.
- A transport failure appends an "is `ollama serve` running?" hint to your error.

## OpenAiEmbedder: /v1/embeddings

```rust
use loopctl::provider::embeddings::OpenAiEmbedder;

let embedder = OpenAiEmbedder::from_env()?;   // OPENAI_API_KEY (required)
                                             // OPENAI_BASE_URL, OPENAI_EMBEDDING_MODEL,
                                             // OPENAI_EMBEDDING_DIMENSIONS (optional pin)
```

Your default is `text-embedding-3-small` at 1536 dimensions. Your API key is redacted in `Debug` output and sent as a sensitive bearer header.

The embedder exposes the 3-series Matryoshka truncation. When you call `with_dimensions(n)`, you request shorter vectors of the same family, validated as `256..=3072`, and each model's own maximum still applies server-side. That field rides your request only when you set it.

## Shared contracts

Both backends honor the same seven contracts:

- **Batching.** `embed_texts` splits at 256 inputs or an estimated 250,000 token sum per request, whichever closes first, and it runs over the shared error-classification path. Your per-batch `loopctl.embed.batch` metric events carry the usage pair when reported.

- **Bounded reads.** Response budgets are derived from the dimension and clamped between 1 and 64 MiB, so a hostile stream cannot balloon your memory. An over-declared content-length is refused up front.

- **Dimension honesty.** A server answer whose length differs from your configured `dim()` fails as a config-validation error naming both numbers, after a WARN metric event. Embedding models are not interchangeable across a store's lifetime, so a silent mismatch would be index corruption.

- **OpenAI reassembly by `data[].index`.** Never by array position. Row count and permutation are both verified, and duplicate or out-of-range indices are refused.

- **Per-input guard.** Every input is checked against the 8191 token ceiling using a chars-divided-by-4 estimate before any wire traffic, and a failure names the input index.

- **`normalized()`.** This is optional L2 normalization in place, scaled by the max-abs component so that huge-but-finite answers normalize exactly instead of overflowing to a silent zero vector. Component finiteness is enforced on every answer either way.

- **Validated builders.** You get the family's shared HTTP config, meaning timeouts, pool, and an injectable client, with trailing-slash base URLs trimmed at build.

One retrieval note spans the whole stack: a `k` of `0` returns empty on every index tier. On the external tiers in [`loopctl-vector`](/extensions/memory/#the-semantic-tiers), non-finite and zero-norm vectors reject loudly at `add` and `search`, because cosine over a degenerate vector is undefined.

## Related pages

- [Memory](/extensions/memory/) covers what these backends feed: `VectorMemoryStore`, the golden-set bar, and the tier table.
- [API client](/core-data/api-client/) covers the shared HTTP discipline underneath.
- [provider/embeddings.rs, file reference](/file-reference/provider-embeddings/) is the source-level detail.
