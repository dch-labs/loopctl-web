---
title: "`src/compact.rs` — the `ContextManager`"
---


The policy half of compaction: owns the compactor plus window, threshold, target size, and the token counter; classifies every pass.

**Key items**

- `ContextManager::new(compactor)` + builders `with_context_window` (200k), `with_threshold` (80, clamped 1–100), `with_auto_compact` (true), `with_compact_target` (`Threshold` default), `with_compact_target_pct` (**15** since 0.4.0 — of the threshold line), `with_token_counter`.
- `TokenCounter` trait + `HeuristicTokenCounter` — 4 chars/token + 20 chars/message overhead; images 256 flat; deliberately over-estimates (~±30%). `RatioTokenCounter` presets since 0.3.1.
- `CompactSizing { reserved_tokens, target_override }` (0.4.0) — the sizing argument every pass carries: the reserve the landing must leave room for, and the optional one-pass target override (the overflow-salvage arm's strictly-under-the-refused-payload target).
- Entry points: `compact_with_reason(messages, turn, reason, sizing)` — the engine's path; `ensure_context_fits` (host path, checks its own threshold with `>=`); `compact_manual`.
- `should_compact(used)` / `is_emergency(used)` / `compact_reason(used)` — the manager's own trigger view.
- `build_telemetry(...)` — an instance method since 0.4.0, reading the manager's own window.

**Behavior notes**

- **Measurements decide, hints describe:** the manager re-counts the compactor's output with its own counter and overwrites the self-reported numbers.
- Classification: same message count and no shrink → `NoAction`; **an over-target landing declines the same way (0.4.0)**; result over window (minus reserve) → `ContextOverflow`; else `Compacted` with normalized figures.
- `CompactSizing.reserved_tokens` (per-request overhead + a deferred turn's transients) shrinks both the target and the fit check.
- One counter everywhere: the driver reuses the manager's counter for trigger estimates.

Deep dive: [Compaction](/engine/compaction/).
