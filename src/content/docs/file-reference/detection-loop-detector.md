---
title: "`src/detection/loop_detector.rs` — repeated-operation detection"
---


Watches the sliding window of tool operations and flags identical repetitions. (~2,700 lines with tests.)

**Key items**

- `Operation { tool, primary_param, result_hash }` — identical only when all three match; `hash_result(text) -> Option<u64>` (empty → `None`).
- `LoopDetectorConfig` — window 50, repetition threshold 3, stop threshold 10 (0 disables), max same-file reads 5, per-turn tool cap 9999, per-tool thresholds.
- `LoopStatus { is_looping, repeated_operations, repetition_count, warning, should_stop }`.
- Methods: `record`/`record_from_input[_with_error]`, `check_loop` (pure), `max_operation_count`, `mark_warned`, `acknowledge`-support, `check_file_reads`, `clear`/`reset`.
- `ToolSignature` — the per-tool extraction hooks: `extract_primary_param`, `is_recoverable_error`, `get_suggestion`, `normalize_param_for_comparison`, `tool_thresholds`, file-tool markers.
- `global_detector()` — a `OnceLock` singleton default detector.

**Behavior notes**

- Result-hash awareness is the false-positive armor: changing output = progress, never a loop.
- Recording happens per dispatch **attempt** — retries count; recoverable-error marking clears edit-retry false flags.
- Warnings are one-shot per pattern (below stop); the stop consumes the pattern; progress flushes warned entries and their window entries.
- Handles lock poisoning gracefully (skips, returns defaults) — the detector never crashes the loop.

Deep dive: [Loop detection](/safety/loop-detection/).
