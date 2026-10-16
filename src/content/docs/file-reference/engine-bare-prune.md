---
title: "src/engine/bare/prune.rs"
---

This file holds the opt-in prune, the no-LLM reclamation pass. Old tool results beyond a protected tail are cleared to `[cleared: prior tool output]` markers without any summarizer call, so you free context cheaply.

It runs at the pre-request site, before the compaction deferral.

## Key items

`PruneConfig` carries your protected tail token budget, which defaults to 2,000, and the minimum-free gate, which is a fraction of the window defaulting to 10%.

That gate is evaluated in the counter's raw units, so a settled calibration ratio cannot distort the verdict you get.

`BareLoop::set_prune(config)` is opt-in, and default absent means off. Your prune line must sit strictly below the compaction threshold, which is validated with `InvalidInput` and never clamped.

## Behavior notes

Clearing order goes untagged results first, then `Requery` only when the untagged pool cannot satisfy the minimum-free gate, and `Durable` never.

Identity survives the marker, meaning call id, tool name, error flag, and retention class, and clearing runs oldest first and deterministically.

The originals hand off to your demotion sink under `CompactReason::Prune`, so pruned is not destroyed.

A prune that frees enough can avert the compaction it would otherwise defer to. The machine then adopts the rewritten conversation through `LoopMachine::adopt_pruned`, which preserves your history and pending split and performs no state transition.

For the deep dive, see [Context accounting and prune](/engine/context-accounting/#prune-reclamation-without-a-summarizer).
