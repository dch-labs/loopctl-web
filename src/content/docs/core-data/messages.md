---
title: "Messages — the conversation data model"
sidebar:
  order: 1
---


Everything the model ever sees is a `Message`. This page covers the whole data model: messages, their parts, roles, images, and tool content. Source: `src/message.rs`.

---

## The shape

A conversation is a `Vec<Message>`. A message is a **role** (who spoke) plus a list of **parts** (what was said). A part can be text, an image, a tool call, or a tool result — several kinds can share one message.

```rust
pub struct Message {
    pub role: Role,               // who sent it
    pub parts: Vec<MessagePart>,  // what was said (can be empty)
}
```

Why parts and not a plain string? Because one model reply can contain **text and tool calls mixed** ("Let me check that... [calls tool]"), and one user reply can contain **several tool results at once**.

### Roles

```rust
pub enum Role { User, Assistant, System }
```

- **`User`** — a human message. Also — by provider convention — the role used for **tool results**. Yes, really: all major providers expect tool results delivered as user-side messages. loopctl does this for you.
- **`Assistant`** — the model's reply (text, tool calls, or both).
- **`System`** — framework-injected context, not part of the chat itself. Providers handle it differently (OpenAI puts it inline as a system message; Anthropic and Gemini require it as a separate top-level field) — loopctl's providers fold system messages automatically, so you rarely build them by hand.

### Parts

```rust
pub enum MessagePart {
    Text      { text: String },                       // plain text
    Image     { source: ImageSource },                // base64-encoded image
    ToolCall  { id: String, name: String, input: Value },  // the model asks to run a tool
    Thinking  { text: String, signature: Option<String>, redacted: Option<String> },  // reasoning
    ToolResult{ call_id: String, name: String, output: ToolContent,
                is_error: Option<bool>, retention: Option<Retention> },
}
```

The pairing rule, which every provider enforces:

```text
Assistant:  [ToolCall  id="call_1" name="read_file" input={...}]   ← the model asks
User:       [ToolResult call_id="call_1" name="read_file" output="file contents..."]
                                                        ↑ your program answers, same id
```

- `id` is assigned by the **provider** and must be unique within a turn.
- `ToolResult.call_id` must match the `ToolCall.id` it answers.
- `ToolResult.name` matters for providers that match by name (Gemini does); loopctl fills it for you.
- `is_error: Some(true)` marks a failed tool run; `None` or `Some(false)` means success.
- `retention` tags how compaction may treat the result (see [retention classes](#retention-classes--what-compaction-may-clear) below); `None` is the untagged default.

### Thinking parts — reasoning, signatures, redaction

`Thinking` is the model's private scratch reasoning, streamed separately from the answer text. Two optional fields exist for providers that *sign* their reasoning (Anthropic does):

- **`signature`** — the provider's signature over a visible reasoning block. Some providers refuse to continue a conversation whose prior thinking lacks a valid signature, so loopctl latches it from the delta and replays it verbatim on later requests.
- **`redacted`** — the opaque payload of a reasoning block the provider withheld (you see nothing; it still demands the placeholder back on continuations). `text` is empty in that case.

**The retention policy (since 0.4.0): thinking rides the conversation verbatim.** Prior turns' thinking blocks stay in the message list until a compaction pass ages them out — the engine no longer strips them at turn boundaries. Why: every strip rewrote the request prefix, so provider-side prompt caches never hit and every call re-prefilled the whole conversation. Keeping history byte-stable keeps the cache hitting; the cost is window space for the reasoning's lifetime, which tightens the compaction cadence on reasoning-heavy models. The newest assistant message's thinking always rode its own tool loop — the interleaved-thinking replay contract providers require — and still does.

### Handy constructors and readers

```rust
Message::user("hello")                      // User role + one text part
Message::assistant("hi there")              // Assistant role + one text part
Message::new(role, parts)                   // full control
msg.text_content()                          // all text parts joined (skips tool parts)
msg.tool_call_parts()                       // [(id, name, input), ...] for every tool call
MessagePart::text("hi")
MessagePart::tool_call("call_1", "echo", json!({"message": "hi"}))
MessagePart::tool_result("call_1", "echo", "echo: hi", false)
part.as_text()                              // Some(&str) only for Text parts
```

---

## Images

Images are base64-encoded (a text encoding of binary bytes — what you get from most image libraries):

```rust
let source = ImageSource::new_base64("image/png", base64_data);
let part = MessagePart::Image { source };
let msg = Message::new(Role::User, vec![part]);
```

> **Gotcha 1:** image parts are only valid in `Role::User` messages. Providers reject them in assistant messages.
> **Gotcha 2:** loopctl's own provider clients currently **drop** image parts when building requests (each converter notes "not supported in this path"). The data model carries images end-to-end, but the built-in clients do not send them yet. If you need vision, plan on a custom `ApiClient`.

---

## Tool output content — `ToolContent`

A tool's output is either plain text or several parts:

```rust
pub enum ToolContent {
    Text(String),                       // the common case
    Multipart(Vec<ToolContentPart>),    // text + images mixed, or several text blocks
}

pub enum ToolContentPart {
    Text  { text: String },
    Image { source: ImageSource },
}
```

Details worth knowing:

- `ToolContent::from_string("x")` and `.into()` from `String`/`&str` build the text form.
- `Display` (what `to_string()` gives you) prints text parts joined with newlines and **silently skips images**. If you log `to_string()` of a screenshot tool's output, you'll see nothing of the screenshot.
- A multipart result carrying images is the standard way for a tool to hand a picture to the model (subject to the provider limitation above).

---

## Serialization

Every type here serializes and deserializes with `serde` (JSON). Internally, `MessagePart` is tagged with `"type"`, so the JSON looks like:

```json
{ "role": "user", "parts": [ { "type": "text", "text": "hello" } ] }
```

This is what makes the "save the machine, resume later" trick possible — the conversation inside the brain is pure serializable data.

> **Gotcha:** `ToolResult.name` has a serde default of `""` so older saved conversations (before the field existed) still load. Don't rely on `name` being non-empty when reading foreign data.

### The exact wire shapes, all four parts

```json
{ "type": "text",        "text": "hello" }
{ "type": "image",       "source": { "encoding": "base64", "media_type": "image/png", "data": "…" } }
{ "type": "tool_call",   "id": "call_1", "name": "read_file", "input": { "path": "a.rs" } }
{ "type": "thinking",    "text": "…", "signature": "…" }
{ "type": "tool_result", "call_id": "call_1", "name": "read_file", "output": "…", "is_error": true }
```

`signature`/`redacted` serialize only when present (`skip_serializing_if`), and `retention` follows the same rule — old saved conversations load unchanged.

`ToolContent` is **untagged**: `Text` serializes as a plain JSON string, `Multipart` as an array of `{"type":"text"|"image", …}` objects — no wrapper either way. An empty `parts` list is legal (and means silence).

Reader semantics carry one subtlety worth pinning: `text_content()` concatenates text parts with **no separator** — consecutive text parts are one logical stream (`"a"` + `"b"` → `"ab"`). `Display` (what logging and `to_string()` produce) is different on purpose: it joins with **newlines** and renders non-text parts as brackets — `[Tool: read_file with input: {…}]`, `[Tool Result: …]`, `[Image: image/png]` — so log output and `text_content()` of the same message can legitimately differ.

One deliberate omission: there is **no `Message::system()` constructor**. System-role messages are framework-built (`Message::new(Role::System, …)` — that's what contributors emit); your code expresses standing guidance through the session's system prompt, where every provider routes it correctly.

---

## Retention classes — what compaction may clear

A tool result can carry a `Retention` tag (set with `MessagePart::tool_result(...).with_retention(...)` or by your tool through `ToolOutput` — see [tools](/core-data/tools/)):

| Class | Meaning | What compaction and pruning do with it |
|---|---|---|
| *(untagged)* | Default | First to go: old untagged results are exactly what the [prune](/engine/context-accounting/) pass clears. |
| `Requery` | Re-derivable — the model can fetch it again (a file read, a search hit) | Cleared after the untagged pool is exhausted; the omission marker names the tool call so a summary cannot restate content it never saw. |
| `Durable` | Non-re-derivable — losing it loses information | Exempt from pruning; compaction summarizes rather than deletes where the tag is honored. |

The tag travels with the part through serialization, so a checkpointed conversation keeps its retention decisions.

---

## Put it together — a mini conversation

```rust
let conversation = vec![
    Message::user("What is in notes.txt?"),
    Message::new(Role::Assistant, vec![MessagePart::tool_call(
        "call_1", "read_file", json!({"path": "notes.txt"}),
    )]),
    Message::new(Role::User, vec![MessagePart::tool_result(
        "call_1", "read_file", "meeting notes: buy milk", false,
    )]),
    Message::assistant("The file says: buy milk."),
];
```

That's the entire model — five shapes (`Message`, `Role`, `MessagePart`, `ToolContent`, `ImageSource`) that every other subsystem builds on.

---

## Related pages

- [Tools](/core-data/tools/) — where `ToolCall` requests come from and how results are produced.
- [The big idea](/start-here/the-big-idea/) — where these messages live (history vs pending).
- [File reference: message.rs](/file-reference/message/)
