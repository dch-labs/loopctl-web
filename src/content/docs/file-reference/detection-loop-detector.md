---
title: "src/detection/loop_detector.rs"
---

This file watches your sliding window of tool operations and flags identical repetitions. It runs about 2,700 lines with tests.

## Key items

`Operation { tool, primary_param, result_hash }` counts as identical only when all three match, and `hash_result(text) -> Option<u64>` returns `None` for empty text.

`LoopDetectorConfig` ships window 50, repetition threshold 3, stop threshold 10 (0 disables), max same-file reads 5, per-turn tool cap 9999, and per-tool thresholds.

`LoopStatus { is_looping, repeated_operations, repetition_count, warning, should_stop }` is what you read after a check.

You record through `record`, `record_from_input`, and `record_from_input_with_error`, then ask `check_loop`, which stays pure. Your other methods cover `max_operation_count`, `mark_warned`, acknowledge-support, `check_file_reads`, `clear`, and `reset`.

`ToolSignature` gives you the per-tool extraction hooks: `extract_primary_param`, `is_recoverable_error`, `get_suggestion`, `normalize_param_for_comparison`, `tool_thresholds`, and the file-tool markers.

`global_detector()` hands you a `OnceLock` singleton as your default detector.

## Behavior notes

Result-hash awareness is your false-positive armor: changing output means progress, never a loop.

Recording happens per dispatch attempt, so your retries count, and recoverable-error marking clears edit-retry false flags.

Warnings are one-shot per pattern below the stop threshold. Your stop consumes the pattern, and progress flushes warned entries along with their window entries.

Treat lock poisoning gracefully here: the detector skips and returns defaults, so it never crashes your loop.

Deep dive: [Loop detection](/safety/loop-detection/).
