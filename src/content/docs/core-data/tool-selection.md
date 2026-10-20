---
title: "Tool selection"
sidebar:
  order: 7
---

A registry can hold fifty tools, but the request does not have to carry all of them. Frontier models handle a wide tool list. Small ones pick the wrong tool, conflate similar tools, or call tools that do not exist.

A **tool selector** narrows what the model sees each turn. Every schema also spends window tokens on every request you send. Added in 0.4.1. Source: `src/tool/selector.rs`.

Two surfaces come apart:

| Surface | What it is | Who reads it |
|---|---|---|
| **Registered** | Everything the [registry](/core-data/tools/#toolregistry) knows | dispatch, unknown-name checks |
| **Advertised** | The subset riding this turn's request | the model, the window estimate |

## The trait and the context

Write one method:

```rust
pub trait ToolSelector: Send + Sync {
    fn select(&self, ctx: &SelectionContext<'_>, all: &[ToolSchema])
        -> Vec<ToolSchema>;
}

pub struct SelectionContext<'a> {
    pub turn: usize,                          // turn number within the run
    pub latest_user_message: Option<&'a str>, // the run's opening prompt
    pub conversation: &'a [Message],          // what the request carries
}
```

The engine consults your selector exactly once per turn, at the request-build step. Whatever you return is threaded into two places as one selection: the outbound request, and the window estimate. The figure counts what the wire carries, never the whole registry.

Install one on the loop with `with_tool_selector`, or change it later with `set_tool_selector`:

```rust
use loopctl::tool::KeywordSelector;

let agent = BareLoop::new_with_managers(client, registry, config, managers)
    .with_tool_selector(Arc::new(KeywordSelector::default()));
```

The default is no selector. Every registered tool is advertised, byte-identical to a loop that has never heard of selection. `StaticSelector` exists when you want that behavior as an explicit knob.

Four rules apply to your implementation:

- Return schemas that are members of the `all` slice you were handed. The engine advertises your selection verbatim, so a fabricated schema would advertise a tool the registry cannot dispatch.
- An empty return advertises no tools at all, and the request omits the `tools` field. If you never want that outcome, own your fail-open policy.
- Keep selection deterministic for a given context. The engine threads one selection into both the request and the estimate, so drifting output makes the estimate unexplainable.
- `ToolConstraint::Strict` composes automatically. It constrains the model's calls to whatever is advertised this turn.

The selection query is the run's opening prompt on every turn, never a continuation turn's tool-result text. Transients ride the request view too, so an attachment or memory that introduces a tool is visible to the selection that needs it.

## KeywordSelector

`KeywordSelector` tokenizes the prompt and each tool's name plus description into lowercase words of three or more characters. Stopwords like "the" and "for" drop out, so a prompt's "the" cannot advertise every tool whose description says "the".

A tool whose tokens overlap the prompt's is selected. A query that matches nothing fails open to the full surface, because zero advertised tools would strand a model that must act.

Two recall knobs close the gaps where vocabulary misses:

```rust
let selector = KeywordSelector::default()
    .with_synonyms([("lint".into(), "check".into())])
    .with_core_tools(vec!["Read".into(), "Write".into()]);
```

Use `with_synonyms` to expand the query before you match. Pairs are bidirectional and query-side only. Each side must be one word of three or more characters that is not a stopword, or the pair can never fire.

A curated default table already covers the common drift. "Check" reaches "verify" and "search". "Open", "show", and "view" reach "read". "Fix" and "change" reach "edit". Phrase pairs like "look up" to "search" match on word boundaries, so "look upon" never fires.

Use `with_core_tools` to always include those tools in every non-empty selection. The union composes with fail-open rather than replacing it, so a total miss still serves the full surface with the core set included. A strong wrong-side match can no longer evict a tool every turn needs.

The shipped `Grep` and `Read` descriptions carry the lookup vocabulary for the same reason. Tool-side recall is description wording, not expansion.

## The async family

Keyword recall is structurally insufficient on MCP-mounted surfaces. The async companion trait mirrors the sync one, with `select` returning a future:

```rust
pub trait AsyncToolSelector: Send + Sync {
    fn select<'a>(&'a self, ctx: &'a SelectionContext<'a>,
        all: &'a [ToolSchema])
        -> Pin<Box<dyn Future<Output = Vec<ToolSchema>> + Send + 'a>>;
}
```

Install it with `with_async_tool_selector`. The engine takes a sync selector or an async one, never both. Configure either and it clears the other.

The contract shifts in two ways you must respect:

- Determinism is relaxed. The value of an async selector is the judgment a call buys. The once-per-turn discipline keeps the estimate explainable instead.
- Fail open is your job. When you hit an embed error, a rewrite timeout, or output naming no known tool, advertise the full surface. Keep the right to return an intentional empty selection, never emptiness from inability to rank. The engine advertises whatever you send back, silence included.

The engine races the selection against the cancel signal, so a cancelled run never waits on a slow selector.

### EmbeddingSelector

`EmbeddingSelector` needs the `vector_index` feature. It embeds each tool's name plus description once per registry generation, cached against the ordered name list. A registry mutation changes the list, so the next turn re-embeds.

The query embeds fresh every turn, and the top-k nearest by cosine ride the request. Call `with_top_k(k)` to set k, which defaults to 8.

```rust
let selector = EmbeddingSelector::new(embedder).with_top_k(6);
```

Cost is one embedding call per turn plus one per registry generation. Any embed failure fails open to the full surface with a warning. A query whose vector cannot rank fails open too.

### RewritingSelector

`RewritingSelector` makes one small non-streaming call per turn. The prompt carries tool names and one-line summaries, never the schemas, which would spend the tokens selection saves.

It also carries the run prompt and a bounded excerpt of the recent conversation, with each excerpt capped at 400 bytes. The answer names this turn's tool list for you.

```rust
let selector = RewritingSelector::new(Arc::new(client))
    .with_timeout(Duration::from_secs(5))
    .with_budget(budget_limits);
```

Every failure mode fails open to the full surface: transport error, timeout (default 10 s), budget refusal, or an answer naming no known tool. When the answer names some tools, you advertise exactly those, in registry order.

Pass `with_budget(BudgetLimits)` to ride the existing [budget gate](/safety/budget-gate/) machinery. The selector feeds it every rewrite call's reported usage, and refuses further calls on a hard crossing of tokens or wall-clock duration.

## What the estimate counts

Every figure of the upcoming payload counts the advertised subset's own rendered cost. That covers the run's opening estimate, the post-dispatch re-feed, and the pre-request feed.

The compaction reservation alone keeps the full-set figure, since a post-compaction turn may advertise the entire surface again. A wide registry can no longer manufacture a compaction against schemas the wire will not carry.

A change in the advertised surface between requests invalidates the usage anchor with the wire prefix it was built on. A narrowed surface lets the figure fall below the prior report instead of flooring at it. See [context accounting](/engine/context-accounting/).

## Gotchas

1. Do not select away a tool the turn needs. Fail-open selectors protect you on a miss. A custom selector that confidently returns the wrong subset strands the model, so bias toward more tools, not fewer.
2. Selectors read the run prompt on every turn. Do not build a selector that keys on the latest tool result. The context hands you the conversation if you need depth.
3. The corpus cache keys on the embedded texts. Two tools with the same name but different descriptions are different generations, so an overwritten description re-embeds.

## Related pages

- [Tools](/core-data/tools/) covers the registry and the registered surface.
- [The LLM turn](/engine/llm-turn/) is where the selection rides the request.
- [Context accounting](/engine/context-accounting/) explains what the estimate counts.
- [Embeddings](/providers/embeddings/) lists the backends `EmbeddingSelector` uses.
