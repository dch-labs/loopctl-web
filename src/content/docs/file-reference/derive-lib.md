---
title: "crates/derive/src/"
---

`loopctl-derive` is a companion crate in your Cargo workspace. It implements `#[derive(Tool)]`.

Three files turn a `Deserialize` struct into a full `Tool` impl you can register.

The crate exists only when you enable the `derive` feature.

## Files

- [`lib.rs`](#librs): the proc-macro entry point.
- [`attr.rs`](#attrrs): attribute parsing.
- [`expand.rs`](#expandrs): code generation.

### lib.rs

The proc-macro entry point is `#[proc_macro_derive(Tool, attributes(tool))]`.
It is re-exported by loopctl under the `derive` feature.

### attr.rs

Reads the container keys `name`, `description`, `read_only`, `concurrency_safe`,
`system_prompt`, `handler`, and `allow_extra`. Reads the field keys `name`,
`description`, `skip`, and `default`.

It checks that the derive keys agree with the serde renames. Added in 0.3.2: the
split `rename_all` form follows the deserialization side, and flag keys reject
misuse with a named error.

Name derivation is snake-case and acronym-aware. When the same key appears twice,
the later attribute wins.

### expand.rs

It generates your `impl Tool`: the name and description literals, a statically emitted `json!` schema, and a `call` you can invoke.

That `call` clones the `ToolContext`, deserializes your input, and dispatches to the handler, which defaults to `run`.

It also generates the Rust-type to JSON-Schema map, plus the `Option` and serde-default rules for your required list.

Every error case carries a span so you can find it.

## Compile-time guarantees

Every diagnostic is a spanned `syn::Error`, so it surfaces as a normal compile
error at the offending token. The macro itself never panics.

Generated code reaches `serde_json` through `loopctl::__private::serde_json`, so
downstream crates need no direct serde_json dependency.

The UI test suite pins every error message. It lives in
`crates/derive/tests/ui/` with trybuild goldens. Added in 0.3.2: the serde-parity
fixtures `serde_flatten`, `serde_transparent`, and `unknown_rename_all`.

Added in 0.4.0: the matrix is at full breadth, with 28 compile-fail cases and 3 pass cases.

A consumer-hygiene fixture in `crates/derive/tests/consumer/` builds a downstream crate that depends on the macro.

It caught the hard-coded `loopctl::` paths, so a renamed dependency now works for you.

Deep dive: [The derive macro](/integration/derive-macro/).
