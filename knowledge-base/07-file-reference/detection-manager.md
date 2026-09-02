# `src/detection/manager.rs` — the `DetectionManager` facade

Owns one `LoopDetector` and one `ConvergenceDetector` plus stats; the engine's single entry point into detection.

**Key items**

- `DetectionConfig` — loop threshold 3, stop threshold 10, max history 100, convergence threshold 0.95, convergence count 3, both enables true, `on_converge: Warn`.
- Constructors: `new`, `new_with_config`, `new_with_loop_detector`, `new_with_signature` (copies the signature's per-tool thresholds).
- Recording: `record_operation` (returns `DetectedPattern`), `record_tool_call[_with_result]`, `record_response` (terminal replies only).
- Pure queries: `check_loop_pattern`, `check_convergence_pattern`, `check_current_pattern` (loop first).
- `consume_pending_loop_stop()` — clears an unfired stop at run end so the next run isn't killed by repetitions it never produced; convergence state deliberately untouched.
- `acknowledge_loop_warning`, `stats()`, `reset()` (config not reset).

**Behavior notes**

- A `should_stop` pattern recording auto-marks warned; the engine's fired stop clears the window.
- Poison handling splits: the manager's own mutexes propagate `LockPoisoned` (`convergence_detector`, `detection_stats`); the inner `LoopDetector` degrades gracefully. The engine's response to a detection poison: disable detection for the session (advisory system), never fail the run.
- Stop counts are window-relative — eviction by `max_history` can reset them; raise it for slow loops.

Deep dives: [loop](../03-safety/02-loop-detection.md) · [convergence](../03-safety/03-convergence.md).
