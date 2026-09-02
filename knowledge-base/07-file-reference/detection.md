# `src/detection.rs` — the detection module root

A thin root: re-exports everything from the three implementation files and holds the module documentation.

**Key items (re-exports)**

- From `loop_detector`: `LoopDetector`, `LoopDetectorConfig`, `LoopStatus`, `Operation`, `ToolSignature`, `NoOpToolSignature`, `hash_result`, `global_detector`.
- From `convergence`: `ConvergenceDetector`, `ConvergenceConfig`, `ConvergenceStatus`, `ConvergenceAction`, `ConvergenceConfigError`.
- From `manager`: `DetectionManager`, `DetectionConfig`, `DetectionStats`, `DetectedPattern`.

**Behavior notes**

- Two detectors, one facade: loop detection (repeated operations) and convergence detection (repeated answers) — independent enable flags, one `reset()`.
- The engine checks loop first ("a tool-calling loop is a stronger signal").

Deep dives: [loop detection](../03-safety/02-loop-detection.md) · [convergence](../03-safety/03-convergence.md) · [manager](detection-manager.md).
