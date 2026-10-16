---
title: "src/determinism.rs"
---

This file is where every nondeterministic input the engine touches enters, through a trait you can replace.

Swap in a fixed clock and seeded generators and the same run produces the same bytes. That is the precondition for byte-stable replay and cassette-era tooling.

You install these seams through `LoopManagers::with_clock` and `with_id_gen`.

## Key items

`Clock` gives you `SystemClock`, the default, or `FixedClock::new(SystemTime)`.

Your engine stamps gate records and telemetry from the managers' clock seam, so no hidden `SystemTime::now()` bypasses it.

`IdGen` gives you `UuidIdGen`, the default, or `SeededIdGen::new(seed)`. The seeded form reproduces its id sequence from the seed alone.

Those ids keep v4 version and variant bits, so they stay parse-compatible with what you get from the default.

`Rng` gives you `ThreadLocalRng`, the default, or `SeededRng::new(seed)`. The stream handler's jitter draws through this seam.

## Behavior notes

Each seeded type's entire state is its seed, which `seed()` exposes. So a fresh generator built from that seed replays the sequence from the start.

These seams are why "same run, same bytes" is testable, and why your gate-record timestamps read `0` before the engine stamps them.

For the deep dive on where the seams install, see [Managers](/extensions/managers/).
