# `src/compact/rolling.rs` — `RollingCompactor`, the maintenance-cadence compactor

Compaction as a rolling cadence rather than one big rewrite: each pass re-processes only the **groups older than `age_turns`** (turn groups bounded by pair-safe role-transition boundaries), rolling them into micro-summaries and leaving the recent tail verbatim. Always compiled.

**Key items**

- `RollingCompactor::new(...)` / `RollingConfig` — the `age_turns` knob (how many turn groups from the end ride verbatim) plus the summarizer-facing budget knobs.

**Behavior notes**

- The pass is cheap by construction — only the aged slice is summarized, so a long unattended run pays a small cost per pass instead of one giant rewrite.
- Pairs stay safe: the group boundary snaps to role transitions, so tool call/result pairs never straddle the cut.

Deep dive: [Compaction — the compactor family](../02-engine/06-compaction.md#the-compactor-family)
