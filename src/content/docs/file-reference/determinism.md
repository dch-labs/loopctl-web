---
title: "`src/determinism.rs` — the clock / id / rng seams"
---


Every nondeterministic input the engine touches enters through a trait you can replace: swap in a fixed clock and seeded generators and the same run produces the same bytes — the precondition for byte-stable replay and cassette-era tooling. Installed via `LoopManagers::with_clock` / `with_id_gen`.

**Key items**

- `Clock` — `SystemClock` (the default) or `FixedClock::new(SystemTime)`; the engine stamps gate records and telemetry from the managers' clock seam — no hidden `SystemTime::now()` bypasses it.
- `IdGen` — `UuidIdGen` (default) or `SeededIdGen::new(seed)`: reproduces its id sequence from the seed alone, ids keeping v4 version/variant bits so they stay parse-compatible.
- `Rng` — `ThreadLocalRng` (the default; the stream handler's jitter draws through it) or `SeededRng::new(seed)`.

**Behavior notes**

- Each seeded type's entire state is its seed (`seed()` exposes it): a fresh generator built from the seed replays the sequence from the start.
- The seams are why "same run, same bytes" is testable — and why gate-record timestamps read `0` before the engine stamps them.

Deep dive: [Managers](/extensions/managers/) — where the seams install.
