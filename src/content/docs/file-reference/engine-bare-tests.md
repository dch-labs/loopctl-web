---
title: "`src/engine/bare/tests.rs` — the engine's test suite"
---


The in-file test module for the driver (~5,300 lines) — the crate's behavioral constitution. Reading test names here is the fastest way to learn what the engine guarantees.

**Coverage highlights (by test-name theme)**

- The loop: turn sequencing, terminal behaviors, `finalize` on every path, resume round-trips.
- Compaction: threshold/emergency boundaries (exactly-at vs one-past), no-op vs compacted feeds, no-progress guard, deferred-turn reservation, zero-window policy.
- Dispatch: parallel wave planning, sibling discard, recovery ceiling (`attempts == 6`), panic isolation, unknown-tool pre-answering.
- Cancellation: every checkpoint (model call, stream, tool, backoff, pre-run).
- Config: setter idleness, temp-dir lifecycle, overhead caching.

**Behavior notes**

- Tests double as specification: names are behavior sentences ("`a_zero_window_disables_the_window_policy`"), and the project's TESTING.md culture (fail-first, both-ways boundaries) is visible throughout.
- Cross-file integration tests (`tests/`) cover subsystem seams end-to-end — see [examples & tests](/file-reference/examples-tests/).

Deep dive: [Testing](/integration/testing/).
