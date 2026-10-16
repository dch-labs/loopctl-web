---
title: "src/message.rs"
---

Everything your model ever sees is built from these types: `Message`, `Role`, `MessagePart`, `ImageSource`, `ToolContent`, and `ToolContentPart`.

## Key items

`Message { role, parts }` gives you the constructors `user`, `assistant`, and `new`, plus the readers `text_content()` and `tool_call_parts()`.

`Role` is `User`, `Assistant`, or `System`, serialized in snake_case.

`MessagePart` covers `Text`, `Image`, and `ToolCall { id, name, input }`.

`Thinking { text, signature, redacted }` arrived in 0.4.0, where provider signatures latch and replay, and redacted blocks carry their opaque payload.

`ToolResult { call_id, name, output, is_error, retention }` carries the compaction and prune class since 0.4.0, set with `tool_result(...).with_retention(...)`.

Constructors are `text`, `tool_call`, and `tool_result`, and predicates include `is_text` etc., plus `as_text()`.

`ImageSource::new_base64(media_type, data)` is the only way to build one, and your data must be raw base64 with no data-URI prefix.

`ToolContent` is `Text(String)` or `Multipart(Vec<ToolContentPart>)`, with `From<String>` and `From<&str>`. Its `Display` joins text parts and skips images.

## Behavior notes

Tool results ride `Role::User` messages, which is provider convention and handled everywhere.

Pairing `ToolCall.id` with `ToolResult.call_id` is the load-bearing link, and your engine stamps ids authoritatively.

Everything serializes with serde, and that is what makes machine checkpointing work for you. `signature`, `redacted`, and `retention` ride `skip_serializing_if`, so old saved conversations load unchanged.

Thinking rides the conversation verbatim since 0.4.0, with no turn-boundary strip, and a compaction pass ages it out.

Your prefix stays byte-stable so provider prompt caches keep hitting.

`ToolResult.name` defaults to `""` when you deserialize old data, because the field came later.

Deep dive: [Messages](/core-data/messages/).
