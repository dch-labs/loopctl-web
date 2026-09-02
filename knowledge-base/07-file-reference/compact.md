# `src/compact.rs` — the `ContextManager`

The policy half of compaction: owns the compactor plus window, threshold, target size, and the token counter; classifies every pass.

**Key items**

- `ContextManager::new(compactor)` + builders `with_context_window` (200k), `with_threshold` (80, clamped 1–100), `with_auto_compact` (true), `with_compact_target` (`Threshold` default), `with_compact_target_pct` (70), `with_token_counter`.
- `TokenCounter` trait + `HeuristicTokenCounter` — 4 chars/token + 20 chars/message overhead; images 256 flat; deliberately over-estimates (~±30%).
- Entry points: `compact_with_reason(messages, turn, reason, instructions, additional_context, reserved_tokens)` — the engine's path; `ensure_context_fits` (host path, checks its own threshold with `>=`); `compact_manual`.
- `should_compact(used)` / `is_emergency(used)` / `compact_reason(used)` — the manager's own trigger view.
- `build_telemetry(...)` — for hosts running compaction themselves.

**Behavior notes**

- **Measurements decide, hints describe:** the manager re-counts the compactor's output with its own counter and overwrites the self-reported numbers.
- Classification: same message count and no shrink → `NoAction`; result over window (minus reserve) → `ContextOverflow`; else `Compacted` with normalized figures.
- `reserved_tokens` (per-request overhead + a deferred turn's transients) shrinks both the target and the fit check.
- One counter everywhere: the driver reuses the manager's counter for trigger estimates.

Deep dive: [Compaction](../02-engine/06-compaction.md).
