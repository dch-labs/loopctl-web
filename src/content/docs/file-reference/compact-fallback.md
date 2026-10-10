---
title: "`src/compact/fallback.rs` — `FallbackCompactor`, the never-fail chain"
---


Compaction becomes unconditionally successful: the chain holds ordered compactor stages and runs them in sequence until one returns `success: true` — with a non-failing terminal, an out-of-tokens condition stops surfacing as a failed pass. Always compiled.

**Key items**

- `FallbackCompactor::default_chain(client)` — QA → structured → `TerminalCapture(TruncatingCompactor)`: quality-descending, blind truncation only as the last resort.
- `ChainBuilder` — `stage(name, compactor)` for any `Arc<dyn ContextCompactor>`, `terminal(&truncator)` for the never-fail finale, `config` before `terminal()` (the floor is captured at `terminal()` time). Warns — never errors — when the last stage's name doesn't heuristically name a terminal.
- `TerminalCapture` — the structural floor: it reconstructs the wrapped truncator with `preserve_recent = max(its own, terminal_min_recent)` (default 4, `FallbackConfig` clamps ≥ 1), so the active turn and neighbors survive every stage including the last resort.
- `ChainReport` / `StageOutcome` / `last_report()` — provenance: which stage ran, which won, each stage's error and token figure; `winning_stage` is the seam a host surfaces as `"FallbackCompactor(TruncatingCompactor)"`.

**Behavior notes**

- Every stage receives the same `target_tokens` and a cloned context whose `tokens_before` is recomputed with the context's counter — and every stage runs against a **clone of the original input**: a failed stage's returned messages are discarded, never handed onward (a misbehaving stage's partial or emptied list cannot corrupt its successors), and the all-failed outcome carries the original.
- Past the loop (a chain with no non-failing terminal), failure is honest: `CompactionOutcome::failed("all compactor stages failed")`, originals intact, nothing evicted. An empty chain has the same shape.
- Telemetry: `loopctl.compaction.passes` (one event per successful pass, `stage` = the winner's name) and `loopctl.compaction.degradations` (one per failed stage declined through, `from`/`to`).

Deep dive: [Compaction — the compactor family](/engine/compaction/#the-compactor-family)
