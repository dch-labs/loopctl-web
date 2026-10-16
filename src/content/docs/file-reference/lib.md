---
title: "src/lib.rs"
---

This file is the front door of the library. It declares every public module with its feature gate, carries the crate-level documentation map, and re-exports two conveniences you will actually type.

## Key items

`pub use tool::Tool` puts the trait at your crate root, so `use loopctl::Tool` works without reaching into a module.

Under `feature = "derive"` you also re-export `loopctl_derive::Tool`, the derive macro, so one import brings you the trait and the derive together.

`pub mod __private` is hidden and derive-only. It re-exports `serde_json` so your downstream crate never needs that dependency directly for generated code.

Your feature-gated modules are `hooks`, `mcp`, `provider` under `providers`, and `testing`.

## Behavior notes

`#![warn(missing_docs)]` means every public item in the crate is documented, so the doc comments reward you as primary reading.

`numeric` stays `pub(crate)`. It is internal safe math, intentionally not public.

Test builds relax the strict no-unwrap clippy set. Your production code never panics, while test code may assert freely.

Deep dive: [the codebase map](/start-here/codebase-map/).
