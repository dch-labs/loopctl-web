---
title: "`src/compact/structured_summarizer.rs` — `StructuredSummarizer`, the sectioned LLM compactor"
---


The QA summarizer optimizes *retention*; this one optimizes *shape*: one LLM call (plus at most one retry) produces a summary whose headings are contractually stable — key facts, decisions, pending tasks, open questions, each a `- ` bullet list — so a consumer locates "pending tasks" without parsing prose, and a model re-entering a marathon session scans a skeleton instead of a wall of narrative. Always compiled.

**Key items**

- `SummaryTemplate { sections, header }` — drives both sides of the contract from one field: the system prompt enumerates exactly the configured sections with their exact `### ` headings; the renderer emits header + non-empty sections in template order (empty sections omitted; a fully-empty summary renders the one-line stub). `default_template()` (all four) and `action_only()` (decisions + pending) are the presets; `SummarySection` is `#[non_exhaustive]`.
- `StructuredSummarizer::new(client, config)` / `StructuredSummaryConfig`; `StructuredSummary` + the free `render(summary, template)` — summary data and rendering are separable.

**Behavior notes**

- The response parses tolerantly — a JSON object keyed by `snake_case` section names *or* a heading scan (any `#` depth, any casing, trailing colons, `- `/`* `/numbered bullets, fenced answers); each section caps at 50 items. No recognizable heading → exactly one retry with a sharper instruction; still malformed → degrade to raw text as the first rendered section's single entry (never an error). `parse_output = false` carries raw text directly.
- Failure parity with the QA tier: blank or over-budget responses fail the pass through the typed path; `ApiError` fails with originals intact; leading system messages survive at the head, never in the transcript; hook guidance reaches the prompts.
- Telemetry: one `loopctl.compaction.structured.sections` event per section per successful pass (`state=populated|empty` — a climbing empty rate is the earliest sign the template degraded).

Deep dive: [Compaction — the compactor family](/engine/compaction/#the-compactor-family)
