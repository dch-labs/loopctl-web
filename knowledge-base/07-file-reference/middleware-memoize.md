# `src/middleware/memoize.rs` — `MemoizingMiddleware`

A per-turn-window cache for read-class tools, invalidated by write-class tools via declared paths.

**Key items**

- `MemoizingMiddleware::new(tools, write_tools, path_extractor, ttl_turns)` — all four explicit; `ttl 0` caches nothing; `NoopPathExtractor` disables path invalidation.
- `PathExtractor::paths(tool, input) -> Vec<String>` — matched **verbatim**; be generous (over-returning only over-invalidates).
- Cache key: tool name + hash of canonicalized input JSON; entries carry result + turn + paths.

**Behavior notes**

- Errors are **never** cached; write results are **never** cached; a failed write doesn't invalidate (filesystem unchanged).
- A hit appends `[cached]`, carries the **requesting** call's id, and replays the **original** duration (health stats track real latency).
- Concurrency-safe under parallel dispatch: an epoch check prevents a computed result from outliving a concurrent invalidation.
- No capacity limit / no LRU — pair with a short TTL for long sessions.
- `serde_json`'s `preserve_order` feature anywhere in your tree breaks key-order canonicalization.

Deep dive: [Middleware](../03-safety/01-middleware.md).
