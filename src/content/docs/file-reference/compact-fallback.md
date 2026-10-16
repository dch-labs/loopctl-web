---
title: "src/compact/fallback.rs"
---

This file makes compaction unconditionally successful for you. The chain holds ordered compactor stages and runs them in sequence until one returns `success: true`.

With a non-failing terminal, an out-of-tokens condition stops surfacing as a failed pass. This file is always compiled.

## Key items

`FallbackCompactor::default_chain(client)` gives you QA, then structured, then `TerminalCapture(TruncatingCompactor)`, which is quality-descending, with blind truncation only as the last resort.

`ChainBuilder` gives you `stage(name, compactor)` for any `Arc<dyn ContextCompactor>` and `terminal(&truncator)` for your never-fail finale.

Call `config` before `terminal()`, because the floor is captured at `terminal()` time. The builder warns, and never errors, when the last stage's name does not heuristically name a terminal.

`TerminalCapture` is the structural floor. It reconstructs your wrapped truncator with `preserve_recent = max(its own, terminal_min_recent)`, which defaults to 4, and `FallbackConfig` clamps it to at least 1.

That is how your active turn and neighbors survive every stage including the last resort.

`ChainReport`, `StageOutcome`, and `last_report()` give you provenance: which stage ran, which won, and each stage's error and token figure.

Your `winning_stage` is the seam you surface as `"FallbackCompactor(TruncatingCompactor)"`.

## Behavior notes

Every stage receives the same `target_tokens` and a cloned context whose `tokens_before` is recomputed with the context's counter.

Every stage runs against a clone of your original input, so a failed stage's returned messages are discarded rather than handed onward.

A misbehaving stage's partial or emptied list therefore cannot corrupt its successors, and the all-failed outcome carries the original.

Past the loop, on a chain with no non-failing terminal, failure is honest: `CompactionOutcome::failed("all compactor stages failed")` with your originals intact and nothing evicted. An empty chain has the same shape.

Telemetry emits `loopctl.compaction.passes`, one event per successful pass where `stage` is the winner's name, and `loopctl.compaction.degradations`, one per failed stage declined through, tagged `from` and `to`.

For the deep dive, see [Compaction and the compactor family](/engine/compaction/#the-compactor-family).
