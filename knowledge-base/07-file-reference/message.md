# `src/message.rs` — the conversation data model

Everything the model ever sees is built from these types: `Message`, `Role`, `MessagePart`, `ImageSource`, `ToolContent`, `ToolContentPart`.

**Key items**

- `Message { role, parts }` — constructors `user`, `assistant`, `new`; readers `text_content()`, `tool_call_parts()`.
- `Role` — `User`, `Assistant`, `System` (snake_case serde).
- `MessagePart` — `Text`, `Image`, `ToolCall { id, name, input }`, `ToolResult { call_id, name, output, is_error }`; constructors `text`, `tool_call`, `tool_result`; predicates `is_text` etc., `as_text()`.
- `ImageSource::new_base64(media_type, data)` — always use the constructor; data must be raw base64 (no data-URI prefix).
- `ToolContent` — `Text(String)` or `Multipart(Vec<ToolContentPart>)`; `From<String>`/`From<&str>`; `Display` joins text parts and **skips images**.

**Behavior notes**

- Tool results ride `Role::User` messages — provider convention, handled everywhere.
- `ToolCall.id` ↔ `ToolResult.call_id` pairing is the load-bearing link; the engine stamps ids authoritatively.
- Everything serializes with serde — this is what makes machine checkpointing work.
- `ToolResult.name` defaults to `""` when deserializing old data (the field came later).

Deep dive: [Messages](../01-core-data/01-messages.md).
