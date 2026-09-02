# `src/detection/convergence.rs` — repeated-answer detection

Flags the agent's terminal replies becoming near-identical, turn after turn.

**Key items**

- `ConvergenceConfig { enabled: true, window_size: 3, similarity_threshold: 0.95, on_converge: Warn }` — validated (window ≥ 2; threshold in [0,1]).
- `ConvergenceDetector::add_response(&str) -> ConvergenceStatus` — the feed; `check_convergence()` — pure read; `clear()`.
- `ConvergenceStatus { detected, consecutive_count, similarity_score, similar_responses, action }`.
- `ConvergenceAction` — `Warn` (default), `Stop`, `AskUser`, `Compact`, `SwitchPhase`.
- Similarity: word-set overlap (case-folded, punctuation stripped) computed via `unit_ratio`.

**Behavior notes**

- The streak counts similarity to the **immediately previous** reply only — A/B/A/B never converges; one dissimilar reply resets to 1; an empty reply resets to 0.
- Only terminal replies feed this detector — acting-turn preambles never count (engine-side filter).
- Word overlap is semantically blind: paraphrases evade it, boilerplate false-positives it — hence Warn-by-default and strictly opt-in Stop/AskUser.
- The engine maps `Stop` → `LoopDetected`, `AskUser` → `UserInputRequired`; `Compact`/`SwitchPhase` are host-executed.

Deep dive: [Convergence](../03-safety/03-convergence.md).
