---
title: "src/middleware/memoize.rs"
---

This file gives you a per-turn-window cache for read-class tools, invalidated by write-class tools through declared paths.

## Key items

You build a `MemoizingMiddleware::new(tools, write_tools, path_extractor, ttl_turns)`, where all four are explicit. A `ttl 0` caches nothing, and `NoopPathExtractor` disables path invalidation.

Your builtin `WritePathExtractor` (`middleware::verify::builtin`, 0.4.0) maps write-class calls to their `path`-style fields.

`PathExtractor::paths(tool, input) -> Vec<String>` is matched verbatim, so be generous. Over-returning only over-invalidates.

Your cache key is tool name plus the hash of canonicalized input JSON, and entries carry result, turn, and paths.

## Behavior notes

Errors are never cached, and write results are never cached. A failed write does not invalidate, because your filesystem did not change.

A hit appends `[cached]`, carries the requesting call's id, and replays the original duration, so your health stats track real latency.

This stays concurrency-safe under parallel dispatch: an epoch check prevents a computed result from outliving a concurrent invalidation.

There is no capacity limit and no LRU, so pair this layer with a short TTL for long sessions.

Turn on `serde_json`'s `preserve_order` feature anywhere in your tree and you break key-order canonicalization.

Deep dive: [Middleware](/safety/middleware/).
