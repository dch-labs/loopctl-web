---
title: "src/detection/convergence.rs"
---

This file flags your agent's terminal replies becoming near-identical, turn after turn. Read it when your runs keep answering themselves.

## Key items

Your `ConvergenceConfig { enabled: true, window_size: 3, similarity_threshold: 0.95, on_converge: Warn }` is validated: window must be at least 2, and threshold must land in [0,1].

`ConvergenceDetector::add_response(&str) -> ConvergenceStatus` is your feed. `check_convergence()` is a pure read, and `clear()` restarts the streak.

`ConvergenceStatus { detected, consecutive_count, similarity_score, similar_responses, action }` is what you read back.

`ConvergenceAction` offers `Warn`, the default, plus `Stop`, `AskUser`, `Compact`, and `SwitchPhase`.

Your similarity score measures word-set overlap, case-folded with punctuation stripped, computed through `unit_ratio`.

## Behavior notes

The streak counts similarity to the immediately previous reply only, so A/B/A/B never converges. One dissimilar reply resets the count to 1, and an empty reply resets it to 0.

Only terminal replies feed this detector. Your engine's filter keeps acting-turn preambles out.

Word overlap is semantically blind: paraphrases evade it and boilerplate false-positives it, which is why Warn is the default and Stop or AskUser stay strictly opt-in.

Your engine maps `Stop` to `LoopDetected` and `AskUser` to `UserInputRequired`. It leaves `Compact` and `SwitchPhase` host-executed, which means you run them.

Deep dive: [Convergence](/safety/convergence/).
