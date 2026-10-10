# `src/compact/qa_summarizer.rs` — `QaSummarizer`, the three-step LLM compactor

Truncation's information loss gets a real alternative: a compactor that *preserves the facts a future turn will need*. Each pass runs up to three non-streaming calls on a caller-supplied client (a dedicated cheaper model is the documented production shape): **summarize** the about-to-drop portion; **question gaps** (ask the model what it would need that the summary doesn't carry); **answer** from the full pre-compaction transcript before it's discarded, folding recovered facts under `## Facts recovered` — `N. UNKNOWN` answers dropped so nothing hallucinated enters the summary. Always compiled, no feature flag.

**Key items**

- `QaSummarizer::new(client, config)` / `QaSummarizerConfig` — the budget is reserve-then-cap: `min(max_summary_tokens, target × summary_budget_pct)`, fraction clamped `[0.05, 0.95]` held as an exact per-mille integer; `transcript_max_chars` bounds the input prompt for small local models.
- `PriorSummary` — the running summary (text + pass count) accumulating across passes behind a recovered plain mutex; `prior_summary()` / `reset()` expose and clear it.
- `CompactionSummary` — one pass's parsed result.

**Behavior notes**

- Any `ApiError` fails the pass through `CompactionOutcome::failed` with the **original messages intact** — the `FallbackCompactor` seam. A blank response or an over-budget summary fails the pass the same way (strictly `>` at budget); a sufficient-summary `[]` answer skips step 3.
- Pre-compact hook guidance reaches the prompts (`instructions` + `additional_context`); the previous pass's summary message is filtered out of the transcript so accumulate mode never presents the same summary twice, and a leading system-role message is pulled back unsummarized.
- The split delegates to `TokenSplitter` (pair-safe, snapping to an assistant→user transition); evicted content rides `CompactionOutcome::evicted` for the demotion sink; the summarizer's own token spend reports per pass through `loopctl.compaction.summarizer.tokens` events.

Deep dive: [Compaction — the compactor family](../02-engine/06-compaction.md#the-compactor-family)
