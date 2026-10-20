---
title: "src/tool/selector.rs"
---

This file decides which registered tools each turn advertises. It holds the `ToolSelector` and `AsyncToolSelector` traits, the selection context, and the shipped selectors. Added in 0.4.1.

## Key items

Your sync selector implements `select(&ctx, all) -> Vec<ToolSchema>`. It must be deterministic, object-safe, and return schemas that are members of `all`. An empty return advertises nothing.

`SelectionContext { turn, latest_user_message, conversation }` is what you read. The query is the run's opening prompt every turn, and `conversation` is the request-build view with transients leading history.

Use `StaticSelector` when you want the default, advertise everything, as an explicit knob.

`KeywordSelector` is a fielded `Default` type. It tokenizes into words of three or more characters, drops stopwords, matches by overlap, and fails open to the full surface on a miss.

Build it with `with_synonyms(pairs)` for bidirectional, query-side expansion over the curated defaults. Add `with_core_tools(names)` to union a core set into every non-empty selection.

Your async selector returns a boxed future from the same seam. Determinism is relaxed and fail-open is your job.

`EmbeddingSelector` needs the `vector_index` feature. Call `new(provider)` and `with_top_k`, which defaults to 8.

`RewritingSelector` makes one non-streaming call per turn. Call `new(Arc<C>)`, `with_timeout` (default 10 s), and `with_budget(BudgetLimits)` to ride the budget gate. It shows you names and one-line summaries, never schemas, and caps each conversation excerpt at 400 bytes.

Install with `set_tool_selector` / `with_tool_selector`, or `set_async_tool_selector` / `with_async_tool_selector`. Configure either and the engine clears the other.

## Behavior notes

The engine consults your selector exactly once per turn, ahead of the payload estimate, so the request and the estimate share one selection. Every estimate counts the advertised subset, and the compaction reservation alone keeps the full-set figure.

The selection reads the run prompt over the full request view, transients included. A surface change between requests invalidates the usage anchor so the figure can fall.

The engine races the async selection against cancel, so a cancelled run settles `Cancelled` rather than waiting.

Deep dive: [Tool selection](/core-data/tool-selection/).
