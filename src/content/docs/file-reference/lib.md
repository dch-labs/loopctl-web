---
title: "`src/lib.rs` — the crate root"
---


The front door of the library: declares every public module (with its feature gate), carries the crate-level documentation map, and re-exports two conveniences.

**Key items**

- `pub use tool::Tool;` — the trait at the crate root, so `use loopctl::Tool;` works.
- Under `feature = "derive"`: re-exports `loopctl_derive::Tool` — the derive macro — so the same import brings trait *and* derive.
- `pub mod __private` (hidden, derive only) — re-exports `serde_json` so downstream crates don't need it directly for generated code.
- Feature-gated modules: `hooks` (feature), `mcp` (feature), `provider` (under `providers`), `testing` (feature).

**Behavior notes**

- `#![warn(missing_docs)]` — every public item in the crate is documented; the doc comments are excellent primary reading.
- `numeric` is `pub(crate)` — internal safe math, intentionally not public.
- Test builds relax the strict no-unwrap clippy set — production code never panics, test code may assert freely.

Deep dive: [the codebase map](/start-here/codebase-map/).
