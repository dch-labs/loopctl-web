---
title: "src/compact/rolling.rs"
---

This file gives you compaction as a rolling cadence rather than one big rewrite. Each pass re-processes only the groups older than `age_turns`, rolling them into micro-summaries and leaving your recent tail verbatim.

Turn groups are bounded by pair-safe role-transition boundaries, and this compactor is always compiled.

## Key items

`RollingCompactor::new(...)` and `RollingConfig` give you the `age_turns` knob, which sets how many turn groups from the end ride verbatim.

They also carry the summarizer-facing budget knobs you need.

## Behavior notes

The pass is cheap by construction, since only your aged slice is summarized. So a long unattended run pays a small cost per pass instead of one giant rewrite.

Pairs stay safe, because the group boundary snaps to role transitions and tool call and result pairs never straddle the cut.

For the deep dive, see the compactor family section of [Compaction](/engine/compaction/#the-compactor-family).
