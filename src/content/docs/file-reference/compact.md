---
title: "src/compact.rs"
---

This file is the policy half of compaction. It owns your compactor plus the window, threshold, target size, and token counter, and it classifies every pass.

## Key items

`ContextManager::new(compactor)` takes builders: `with_context_window` at 200k, `with_threshold` at 80 clamped 1 to 100, and `with_auto_compact` true.

It also takes `with_compact_target` with `Threshold` as default, `with_compact_target_pct`, and `with_token_counter`.

That target percentage is 15 of the threshold line since 0.4.0, where it used to be 40.

The `TokenCounter` trait comes with `HeuristicTokenCounter`, which counts 4 chars per token plus 20 chars of message overhead and prices images at 256 flat.

That heuristic deliberately over-estimates by about plus or minus 30%. `RatioTokenCounter` has been available since 0.3.1.

`CompactSizing { reserved_tokens, target_override }` arrived in 0.4.0 and is the sizing argument every pass carries.

It holds the reserve your landing must leave room for, and the optional one-pass target override, which is the overflow-salvage arm's strictly-under-the-refused-payload target.

Your entry points are `compact_with_reason(messages, turn, reason, sizing)` for the engine's path, `ensure_context_fits` for the host path, and `compact_manual`.

Note that your host path checks its own threshold with `>=`.

`should_compact(used)`, `is_emergency(used)`, and `compact_reason(used)` give you the manager's own trigger view.

`build_telemetry(...)` became an instance method in 0.4.0, so it reads your manager's own window.

## Behavior notes

Measurements decide and hints describe. Your manager re-counts the compactor's output with its own counter and overwrites the self-reported numbers.

Classification works like this: same message count and no shrink is `NoAction`, and an over-target landing declines the same way since 0.4.0.

A result over your window minus reserve is `ContextOverflow`, and anything else is `Compacted` with normalized figures.

`CompactSizing.reserved_tokens` covers per-request overhead plus a deferred turn's transients, and it shrinks both your target and your fit check.

One counter runs everywhere, because your driver reuses the manager's counter for trigger estimates.

For the deep dive, see [Compaction](/engine/compaction/).
