---
title: "src/compact/structured_summarizer.rs"
---

The QA summarizer optimizes retention, and this one optimizes shape. One LLM call, plus at most one retry, produces a summary whose headings are contractually stable.

You get key facts, decisions, pending tasks, and open questions, each a `- ` bullet list.

So a consumer locates "pending tasks" without parsing prose, and your model re-entering a marathon session scans a skeleton instead of a wall of narrative. This file is always compiled.

## Key items

`SummaryTemplate { sections, header }` drives both sides of the contract from one field. Your system prompt enumerates exactly the configured sections with their exact `### ` headings, and the renderer emits your header plus non-empty sections in template order.

Empty sections are omitted, and a fully-empty summary renders the one-line stub. `default_template()` gives you all four sections and `action_only()` gives you decisions plus pending, and `SummarySection` is `#[non_exhaustive]`.

`StructuredSummarizer::new(client, config)` builds the compactor from a `StructuredSummaryConfig`, and `StructuredSummary` plus the free `render(summary, template)` keep your summary data and rendering separable.

## Behavior notes

The response parses tolerantly. A JSON object keyed by `snake_case` section names works, and a heading scan works too at any `#` depth and in any casing.

Trailing colons, `- ` and `* ` bullets, numbered bullets, and fenced answers all parse, and each section caps at 50 items.

No recognizable heading gives you exactly one retry with a sharper instruction.

A still-malformed answer degrades to raw text as the first rendered section's single entry, rather than an error. Set `parse_output = false` and raw text is carried directly.

Failure parity with the QA tier holds. Blank or over-budget responses fail the pass through the typed path, and an `ApiError` fails with your originals intact.

Leading system messages survive at the head and never land in the transcript, and hook guidance reaches your prompts.

Telemetry emits one `loopctl.compaction.structured.sections` event per section per successful pass, tagged `state=populated|empty`. A climbing empty rate is the earliest sign that your template degraded.

For the deep dive, see [Compaction and the compactor family](/engine/compaction/#the-compactor-family).
