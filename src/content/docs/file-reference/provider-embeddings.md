---
title: "`src/provider/embeddings.rs` — the real embedders"
---


The two `EmbeddingProvider` backends a real semantic-memory consumer needs — one local, one frontier — behind the provider feature each belongs to plus `vector_index`. No new features; `default = []` untouched.

**Key items**

- `OllamaEmbedder` — Ollama's *native* `/api/embed` endpoint (a chat-profile `/v1` suffix normalized away); defaults to `nomic-embed-text` (768 dims), key-free; `from_env()` requires `OLLAMA_EMBEDDING_MODEL` and deliberately refuses `OLLAMA_MODEL`; `OLLAMA_EMBEDDING_DIM` optionally pins the geometry.
- `OpenAiEmbedder` — `/v1/embeddings`; defaults `text-embedding-3-small` (1536 dims); `with_dimensions(256..=3072)` rides the 3-series' Matryoshka truncation only when set; the key is redacted in `Debug`.
- Both: validated builders with the family's shared HTTP config, `embed_texts` batching (256 inputs or ~250k estimated tokens per request), dimension-derived bounded response reads, optional `normalized()` (exact L2 in place), per-batch `loopctl.embed.batch` metric events.

**Behavior notes**

- **Dimension honesty**: a server answer whose length differs from the configured `dim()` fails as a config-validation error naming both numbers — embedding models are not interchangeable across a store's lifetime.
- OpenAI responses reassemble by `data[].index`, never array position; duplicate or out-of-range sets refuse. Every input guards against the 8191-token ceiling *before* the wire, naming the input index.
- Component finiteness is enforced on every answer (normalized or not); non-finite answers fail the embed.

Deep dive: [Embeddings](/providers/embeddings/)
