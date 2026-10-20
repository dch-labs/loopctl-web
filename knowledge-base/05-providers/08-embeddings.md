# Embeddings — text as vectors, for semantic memory

Semantic memory needs real embeddings: text turned into vectors positioned so similar meanings sit close together. The [`vector_index`](../04-extensions/03-memory.md) feature defines the traits; this page covers the two real `EmbeddingProvider` backends that turn that substrate into working semantic retrieval. Source: `src/provider/embeddings.rs`.

Both live behind the provider feature they belong to (`ollama` / `openai`) plus `vector_index` — no new features, `default = []` untouched.

---

## `OllamaEmbedder` — local, key-free

Speaks Ollama's **native** embedding endpoint (`{OLLAMA_BASE_URL}/api/embed`, with a chat-profile `/v1` suffix normalized away so both profiles share the variable). The legacy singular-input `/api/embeddings` is deliberately unused — no batching, deprecated upstream.

```rust
use loopctl::provider::embeddings::OllamaEmbedder;

let embedder = OllamaEmbedder::from_env()?;   // OLLAMA_EMBEDDING_MODEL (required)
                                             // OLLAMA_BASE_URL (default localhost:11434)
                                             // OLLAMA_EMBEDDING_DIM (optional pin)
// or: OllamaEmbedder::builder().with_model("nomic-embed-text").with_dim(768).build()?
```

- Defaults to `nomic-embed-text` (768 dims), needs no API key.
- `from_env` requires `OLLAMA_EMBEDDING_MODEL` and **deliberately refuses `OLLAMA_MODEL`** (the chat model) — the two can never be silently conflated.
- Transport failures append an "is `ollama serve` running?" hint.

## `OpenAiEmbedder` — `/v1/embeddings`

```rust
use loopctl::provider::embeddings::OpenAiEmbedder;

let embedder = OpenAiEmbedder::from_env()?;   // OPENAI_API_KEY (required)
                                             // OPENAI_BASE_URL, OPENAI_EMBEDDING_MODEL,
                                             // OPENAI_EMBEDDING_DIMENSIONS (optional pin)
```

- Defaults to `text-embedding-3-small` (1536 dims); the API key is redacted in `Debug` output and sent as a sensitive bearer header.
- Exposes the 3-series' **Matryoshka truncation**: `with_dimensions(n)` requests shorter vectors of the same family (validated `256..=3072`; each model's own maximum still applies server-side) — rides the request only when set.

## Shared contracts — both backends

- **Batching** — `embed_texts` splits at 256 inputs or an estimated 250,000-token sum per request, whichever closes first, over the shared error-classification path; per-batch `loopctl.embed.batch` metric events carry the usage pair when reported.
- **Bounded reads** — dimension-derived response budgets (clamped 1–64 MiB) so a hostile stream cannot balloon memory; refused up front on an over-declared content-length.
- **Dimension honesty** — a server answer whose length differs from the configured `dim()` fails as a config-validation error **naming both numbers** (after a WARN metric event). Embedding models are not interchangeable across a store's lifetime — a silent mismatch is index corruption.
- **OpenAI reassembly by `data[].index`** — never array position; row-count and permutation both verified, duplicate or out-of-range indices refused.
- **Per-input guard** — every input is checked against the 8191-token ceiling (chars/4 estimate) *before* any wire traffic; failure names the input index.
- **`normalized()`** — optional L2 normalization in place, scaled by the max-abs component so huge-but-finite answers normalize exactly instead of overflowing to a silent zero vector; component finiteness is enforced on every answer either way.
- **Validated builders** — the family's shared HTTP config (timeouts, pool, injectable client; trailing-slash base URLs trimmed at build).

A `k` of `0` returns empty on every index tier; and on the external tiers ([`loopctl-vector`](../04-extensions/03-memory.md#the-semantic-tier--shipped-040)) non-finite and zero-norm vectors reject loudly at `add`/`search` — cosine over a degenerate vector is undefined.

Both backends also feed a consumer outside memory: `EmbeddingSelector` (0.4.1) embeds a registry's tool corpus and each turn's query to advertise the top-k nearest tools. See [tool selection](../01-core-data/07-tool-selection.md).

---

## Related pages

- [Memory](../04-extensions/03-memory.md) — what these backends feed: `VectorMemoryStore`, the golden-set bar, the tier table.
- [Tool selection](../01-core-data/07-tool-selection.md) — `EmbeddingSelector`, the non-memory consumer.
- [API client](../01-core-data/03-api-client.md) — the shared HTTP discipline underneath.
- [File reference: provider/embeddings.rs](../07-file-reference/provider-embeddings.md)
