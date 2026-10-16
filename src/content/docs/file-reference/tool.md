---
title: "src/tool.rs"
---

This file defines what a tool is, plus everything a tool produces and receives. It runs about 2,300 lines with docs and tests.

## Key items

Your `Tool` trait requires `name`, `description`, `schema`, and `call`.

Provided methods are `is_concurrency_safe` at false, `is_safe_for_concurrent_execution(input)`, `resource_key` at None, `is_read_only` at false, and `system_prompt` at None.

`descriptor_digest()` is new in 0.4.0: a 16-hex FNV-1a-64 over canonical `{name, description, schema}`, which is the grant store's rug-pull pin.

`records_trajectory()` defaults to true, and you set it false when a tool must not become memory, as `SearchMemoriesTool` does.

`ToolSchema { tool, description, input_schema }` names its name field `tool`, follows JSON Schema Draft 07, and serializes into requests verbatim.

`ToolOutput` gives you `success`, `error`, `text`, `error_text`, `structured`, `with_hint`, `with_payload`, `structured_as`, and `with_retention`.

`is_error` is your soft-failure flag, and `with_retention(Retention::…)` stamps the compaction and prune class.

`Retention` is `Requery` for re-derivable output, which is what omission markers in compaction transcripts mark, or `Durable`, which is never evicted.

Untagged is the default as of 0.4.0, and the enum is `#[non_exhaustive]`.

`ToolError` covers NotFound, InvalidInput, Execution, Permission, FileNotFound, Timeout, Cancelled, Io, and Json, with `not_found(tool, available)` building the capped list.

`ToolContext { cwd, session_id, temp_dir, is_non_interactive, user_context, extensions }` carries typed extensions through `set_extension` and `get_extension`.

`DisplayHint` is Text, Diff, Json, Code, Suppress, or Markdown. It is advisory only and never affects loop semantics.

`ToolDispatchResult` is what your engine and pipeline produce per call: id, output, is_error, duration, resolved name, hint, `retention`, and `gate: Option<GateDecision>`.

That last field is new in 0.4.0 and holds the decision record when a gate decided.

## Behavior notes

Your tools must be cancellation-safe, because futures are dropped mid-call on cancel.

Engine-built contexts carry the per-session temp dir, which is cleaned on loop drop. Hosts needing durable dirs must use `extensions` and never `temp_dir`.

Deep dive: [Tools](/core-data/tools/).
