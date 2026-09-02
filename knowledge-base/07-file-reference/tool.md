# `src/tool.rs` — the `Tool` trait and its entourage

The definition of "a tool" plus everything a tool produces and receives. (~2,300 lines with docs/tests.)

**Key items**

- `Tool` — required: `name`, `description`, `schema`, `call`. Provided: `is_concurrency_safe` (false), `is_safe_for_concurrent_execution(input)`, `resource_key` (None), `is_read_only` (false), `system_prompt` (None).
- `ToolSchema { tool, description, input_schema }` — the name field is **`tool`**; JSON Schema Draft 07; serialized into requests verbatim.
- `ToolOutput` — `success/error/text/error_text/structured/with_hint/with_payload/structured_as`; `is_error` is the soft-failure flag.
- `ToolError` — NotFound, InvalidInput, Execution, Permission, FileNotFound, Timeout, Cancelled, Io, Json; `not_found(tool, available)` with the capped list.
- `ToolContext { cwd, session_id, temp_dir, is_non_interactive, user_context, extensions }` — typed extensions via `set_extension`/`get_extension`.
- `DisplayHint` — Text/Diff/Json/Code/Suppress/Markdown; advisory only; never affects loop semantics.
- `ToolDispatchResult` — what the engine/pipeline produce per call: id, output, is_error, duration, resolved name, hint; constructors and builders.

**Behavior notes**

- Tools must be cancellation-safe: futures are dropped mid-call on cancel.
- Engine-built contexts carry the per-session temp dir (cleaned on loop drop); hosts needing durable dirs must use `extensions`, never `temp_dir`.

Deep dive: [Tools](../01-core-data/02-tools.md).
