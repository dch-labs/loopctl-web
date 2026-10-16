---
title: "src/detection.rs"
---

This file is a thin module root. It re-exports everything from your three implementation files and carries the module documentation, so you import detection types from `detection` rather than from a submodule.

## Key items

From `loop_detector` you get `LoopDetector`, `LoopDetectorConfig`, `LoopStatus`, `Operation`, `ToolSignature`, `NoOpToolSignature`, `hash_result`, and `global_detector`.

From `convergence` you get `ConvergenceDetector`, `ConvergenceConfig`, `ConvergenceStatus`, `ConvergenceAction`, and `ConvergenceConfigError`.

From `manager` you get `DetectionManager`, `DetectionConfig`, `DetectionStats`, and `DetectedPattern`.

## Behavior notes

You get two detectors behind one facade: loop detection watches repeated operations, and convergence detection watches repeated answers.

Each carries its own enable flag, and one `reset()` clears both when you restart a run.

Your engine checks loop detection first, because a tool-calling loop is a stronger signal than a repeating answer.

Deep dives: [loop detection](/safety/loop-detection/) · [convergence](/safety/convergence/) · [manager](/file-reference/detection-manager/).
