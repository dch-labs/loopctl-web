---
title: "src/provider/embeddings.rs"
---

This file holds the two `EmbeddingProvider` backends a real semantic-memory consumer needs, one local and one frontier.

Each sits behind the provider feature it belongs to plus `vector_index`, so there are no new features and `default = []` is untouched.

## Key items

`OllamaEmbedder` talks to Ollama's native `/api/embed` endpoint, and a chat-profile `/v1` suffix is normalized away.

It defaults to `nomic-embed-text` at 768 dims and is key-free. `from_env()` requires `OLLAMA_EMBEDDING_MODEL` and deliberately refuses `OLLAMA_MODEL`, and `OLLAMA_EMBEDDING_DIM` optionally pins the geometry for you.

`OpenAiEmbedder` calls `/v1/embeddings` and defaults to `text-embedding-3-small` at 1536 dims.

`with_dimensions(256..=3072)` rides the 3-series Matryoshka truncation only when you set it, and the key is redacted in `Debug`.

Both give you validated builders with the family's shared HTTP config and `embed_texts` batching at 256 inputs or about 250k estimated tokens per request.

Both read responses with a bound derived from your dimension, offer optional `normalized()` for exact L2 in place, and emit per-batch `loopctl.embed.batch` metric events.

## Behavior notes

Dimension honesty is enforced. A server answer whose length differs from your configured `dim()` fails as a config-validation error naming both numbers, because embedding models are not interchangeable across a store's lifetime.

OpenAI responses are reassembled by `data[].index` and never by array position, and duplicate or out-of-range sets refuse.

Every input guards against the 8191-token ceiling before the wire, naming the input index to you.

Component finiteness is enforced on every answer, normalized or not, and non-finite answers fail the embed.

For the deep dive, see [Embeddings](/providers/embeddings/).
