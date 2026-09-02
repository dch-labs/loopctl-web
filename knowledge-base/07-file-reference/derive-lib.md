# `derive/src/` — the `#[derive(Tool)]` crate [feature: derive]

The companion crate `loopctl-derive` (a Cargo workspace member): three files that turn a `Deserialize` struct into a full `Tool` impl.

**Files**

- [`lib.rs`](#librs) — the proc-macro entry point: `#[proc_macro_derive(Tool, attributes(tool))]`, re-exported by loopctl under the `derive` feature.
- [`attr.rs`](#attrrs) — attribute parsing: container keys (`name`, `description`, `read_only`, `concurrency_safe`, `system_prompt`, `handler`, `allow_extra`) and field keys (`name`, `description`, `skip`, `default`); serde-rename agreement checking; the snake-case/acronym-aware name derivation; later-attribute-wins.
- [`expand.rs`](#expandrs) — code generation: the `impl Tool` (name/description literals, statically emitted `json!` schema, `call` that clones the `ToolContext`, deserializes, and dispatches to the handler — default `run`), the Rust-type→JSON-Schema map, the `Option`/serde-default required-list rules, and every spanned error case.

**Behavior notes**

- All diagnostics are spanned `syn::Error`s → normal compile errors at the offending token; the macro itself never panics.
- Generated code uses `loopctl::__private::serde_json` — downstream crates need no direct serde_json dependency.
- The UI test suite (`derive/tests/ui/` with trybuild goldens) pins every error message.

Deep dive: [The derive macro](../06-integration/03-derive-macro.md).
