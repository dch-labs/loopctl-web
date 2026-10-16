---
title: "src/engine/bare/tests.rs"
---

This file is the in-file test module for your driver, running about 5,300 lines, and it is the crate's behavioral constitution. Reading a test-name here is the fastest way to learn what the engine guarantees.

## Coverage highlights

The loop covers turn sequencing, terminal behaviors, `finalize` on every path, and resume round-trips.

Compaction covers threshold and emergency boundaries, exactly-at versus one-past, no-op versus compacted feeds, the no-progress guard, deferred-turn reservation, and zero-window policy.

Dispatch covers parallel wave planning, sibling discard, the recovery ceiling where `attempts == 6`, panic isolation, and unknown-tool pre-answering.

Cancellation covers every checkpoint you have: model call, stream, tool, backoff, and pre-run. Config covers setter idleness, temp-dir lifecycle, and overhead caching.

## Behavior notes

Read these tests as specification. Names are behavior sentences such as `a_zero_window_disables_the_window_policy`, and the project's TESTING.md culture of fail-first, both-ways boundaries shows throughout.

Cross-file integration tests in `tests/` cover your subsystem seams end-to-end. See [examples & tests](/file-reference/examples-tests/).

Deep dive: [Testing](/integration/testing/).
