# `src/message.rs` — the conversation data model

Everything the model ever sees is built from these types: `Message`, `Role`, `MessagePart`, `ImageSource`, `ToolContent`, `ToolContentPart`.

**Key items**

- `Message { role, parts }` — constructors `user`, `assistant`, `new`; readers `text_content()`, `tool_call_parts()`.
- `Role` — `User`, `Assistant`, `System` (snake_case serde).
- `MessagePart` — `Text`, `Image`, `ToolCall { id, name, input }`, `Thinking { text, signature, redacted }` (0.4.0: provider signatures latch and replay; redacted blocks carry their opaque payload), `ToolResult { call_id, name, output, is_error, retention }` (retention = the compaction/prune class, 0.4.0; `tool_result(...).with_retention(...)`); constructors `text`, `tool_call`, `tool_result`; predicates `is_text` etc., `as_text()`.
- `ImageSource::new_base64(media_type, data)` — always use the constructor; data must be raw base64 (no data-URI prefix).
- `ToolContent` — `Text(String)` or `Multipart(Vec<ToolContentPart>)`; `From<String>`/`From<&str>`; `Display` joins text parts and **skips images**.

**Behavior notes**

- Tool results ride `Role::User` messages — provider convention, handled everywhere.
- `ToolCall.id` ↔ `ToolResult.call_id` pairing is the load-bearing link; the engine stamps ids authoritatively.
- Everything serializes with serde — this is what makes machine checkpointing work. `signature`/`redacted`/`retention` ride `skip_serializing_if`, so old saved conversations load unchanged.
- **Thinking rides the conversation verbatim since 0.4.0** — no turn-boundary strip; a compaction pass ages it out. The prefix stays byte-stable so provider prompt caches keep hitting.
- `ToolResult.name` defaults to `""` when deserializing old data (the field came later).

Deep dive: [Messages](../01-core-data/01-messages.md).
