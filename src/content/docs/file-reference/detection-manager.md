---
title: "src/detection/manager.rs"
---

This file owns the `DetectionManager` facade: one `LoopDetector` and one `ConvergenceDetector` plus stats, and it is your engine's single entry point into detection.

## Key items

`DetectionConfig` ships loop threshold 3, stop threshold 10, max history 100, convergence threshold 0.95, convergence count 3, both enables true, and `on_converge: Warn`.

Your constructors are `new`, `new_with_config`, `new_with_loop_detector`, and `new_with_signature`, where the last copies the signature's per-tool thresholds.

Recording runs through `record_operation`, which returns a `DetectedPattern`, plus `record_tool_call` and `record_tool_call_with_result`, plus `record_response` for terminal replies only.

Your pure queries are `check_loop_pattern`, `check_convergence_pattern`, and `check_current_pattern`, which checks loop first.

`consume_pending_loop_stop()` clears an unfired stop at run end so the next run isn't killed by repetitions it never produced. Convergence state is deliberately untouched.

Finish with `acknowledge_loop_warning`, `stats()`, and `reset()`, which leaves config alone.

## Behavior notes

A `should_stop` pattern recording auto-marks warned, and your engine's fired stop clears the window.

Poison handling splits here. The manager's own mutexes propagate `LockPoisoned` for `convergence_detector` and `detection_stats`, while the inner `LoopDetector` degrades gracefully.

Your engine's response to a detection poison is to disable detection for the session, since detection is advisory, and never fail the run.

Stop counts are window-relative, so eviction by `max_history` can reset them. Raise that bound for slow loops.

Deep dives: [loop](/safety/loop-detection/) · [convergence](/safety/convergence/).
