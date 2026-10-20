---
title: "src/compact/qa_summarizer.rs"
---

Truncation's information loss gets a real alternative here, in the `QaSummarizer`. It is a compactor that preserves the facts a future turn will need.

Each pass runs up to three non-streaming calls on a caller-supplied client, and a dedicated cheaper model is the documented production shape.

The first call summarizes the about-to-drop portion, and the second questions gaps by asking the model what it would need that the summary does not carry.

A third call answers from the full pre-compaction transcript before it is discarded.

Recovered facts are folded under `## Facts recovered`, and `N. UNKNOWN` answers are dropped so nothing hallucinated enters your summary. This file is always compiled and has no feature flag.

## Key items

`QaSummarizer::new(client, config)` takes a `QaSummarizerConfig`, and its budget is reserve-then-cap: `min(max_summary_tokens, target × summary_budget_pct)`.

That fraction is clamped to `[0.05, 0.95]` and held as an exact per-mille integer, and `transcript_max_chars` bounds the input prompt for your small local models.

`PriorSummary` is the running summary, meaning text plus pass count, and it accumulates across your passes behind a recovered plain mutex. `prior_summary()` and `reset()` expose and clear it.

`CompactionSummary` is one pass's parsed result.

## Behavior notes

Any `ApiError` fails the pass through `CompactionOutcome::failed` with your original messages intact, which is the `FallbackCompactor` seam.

A blank response or an over-budget summary fails the pass the same way, strictly `>` at budget, and a sufficient-summary `[]` answer skips step 3.

Your pre-compact hook guidance reaches the prompts through `instructions` and `additional_context`. The previous pass's summary message is filtered out of the transcript so accumulate mode never presents you the same summary twice, and a leading system-role message is pulled back unsummarized.

Since 0.4.1 the recognition is two-armed: exact text equality anywhere, or on the first assistant message alone a strip of exactly the leading summary part. The compaction seam now coalesces your summary into the tail's first assistant message, so the recognition reads the coalesced head.

The split delegates to `TokenSplitter`'s budgeted variant, which is pair-safe and snaps to an assistant then user transition. Its durable pull is budget-bounded since 0.4.1, so `Durable` receipts ride verbatim only while your landing's budget allows, newest first.

Evicted content rides `CompactionOutcome::evicted` for your demotion sink, and the summarizer's own token spend reports per pass through `loopctl.compaction.summarizer.tokens` events.

For the deep dive, see [Compaction and the compactor family](/engine/compaction/#the-compactor-family).
