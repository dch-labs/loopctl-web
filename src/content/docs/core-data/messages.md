---
title: "Messages"
sidebar:
  order: 1
---

Everything the model sees is a `Message`. You build them when you hand a conversation to the engine. You read them when you want to know what a run actually sent. Source: `src/message.rs`.

## The shape

A conversation is a `Vec<Message>`. Each message carries a role and a list of parts. The role says who spoke. The parts say what came out, and there can be several of them: text, an image, a tool call, or a tool result.

```rust
pub struct Message {
    pub role: Role,               // who sent it
    pub parts: Vec<MessagePart>,  // what was said (can be empty)
}
```

Read the two fields as one rule: a message is a sender plus a bundle.

Why a bundle and not one string? Because one model reply mixes text with tool calls ("Let me check that", then a call), and one user turn can carry several tool results at once. A string holds neither shape.

### Roles

Three values cover every sender:

```rust
pub enum Role { User, Assistant, System }
```

The naming surprises people, so read the third line carefully.

- `User` is a human message. It is also the role that carries tool results, because every major provider expects them as user-side messages. loopctl puts them there for you.
- `Assistant` is the model's reply. It holds text, tool calls, or both.
- `System` is context the framework injects. It is not part of the chat itself. Providers want it in different places: OpenAI takes it inline, Anthropic and Gemini want a separate top-level field. The provider layer folds your system messages correctly, so you rarely build one by hand.

### Parts

All the variety lives in this enum, and you will build most of these variants by hand sooner or later:

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

Every provider enforces one pairing rule between the last two variants:

```text
Assistant:  [ToolCall  id="call_1" name="read_file" input={...}]   ← the model asks
User:       [ToolResult call_id="call_1" name="read_file" output="file contents..."]
                                                        ↑ your program answers, same id
```

Five rules govern that pair:

- The provider assigns `id`. It must be unique within a turn.
- `ToolResult.call_id` must match the `ToolCall.id` it answers.
- `ToolResult.name` matters for providers that match by name, and Gemini does. loopctl fills it for you.
- `is_error: Some(true)` marks a failed tool run. `None` and `Some(false)` both mean success.
- `retention` tags how compaction may treat the result. `None` is the untagged default. See [retention classes](#retention-classes) below.

### Thinking parts

`Thinking` is the model's private scratch reasoning. It streams separately from the answer text. Some providers sign their reasoning, and Anthropic does. Two optional fields exist for them:

- **`signature`** is the provider's signature over a visible reasoning block. Some providers refuse to continue a conversation whose prior thinking lacks a valid signature, so loopctl latches it from the delta. It replays the signature verbatim on later requests.
- **`redacted`** is the opaque payload of a reasoning block the provider withheld. You see nothing, and the provider still demands the placeholder back on continuations. `text` is empty in that case.

Since 0.4.0, thinking rides the conversation verbatim. Prior turns keep their thinking blocks in the message list until a compaction pass ages them out, and the engine no longer strips them at turn boundaries.

The reason is caching. Every strip rewrote the request prefix, so provider-side prompt caches never hit and you re-prefilled the whole conversation on every call. Keeping history byte-stable keeps the cache hitting.

You pay for that in window space over the reasoning's lifetime, which tightens the compaction cadence on reasoning-heavy models. The newest assistant message always rode its own tool loop with its thinking, because the interleaved-thinking replay contract demands it, and it still does.

### Helper methods

These constructors and readers cover the everyday cases:

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

Reach for `Message::new` whenever a helper does not fit the role or the parts you want.

## Images

An image part carries base64 bytes, which is the text encoding most image libraries hand you:

```rust
let source = ImageSource::new_base64("image/png", base64_data);
let part = MessagePart::Image { source };
let msg = Message::new(Role::User, vec![part]);
```

Gotcha: two limits bite here. Image parts are only valid in `Role::User` messages, and providers reject them in assistant messages.

Worse, loopctl's own provider clients currently drop image parts when building requests, and each converter notes "not supported in this path". The data model carries images end-to-end, but the built-in clients do not send them yet. If you need vision, plan on a custom `ApiClient`.

## Tool output content

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

Three details are worth knowing before you return one:

- `ToolContent::from_string("x")` builds the text form, and so does `.into()` from `String` or `&str`.
- `Display` is what `to_string()` gives you. It joins text parts with newlines and skips images silently, so when you log a screenshot tool's output you see nothing of the screenshot.
- A multipart result carrying images is the standard way for a tool to hand a picture to the model. The provider limit above still applies.

## Serialization

Every type here serializes and deserializes with `serde` over JSON. Internally `MessagePart` is tagged with `"type"`, so the JSON looks like this:

```json
{ "role": "user", "parts": [ { "type": "text", "text": "hello" } ] }
```

That is what makes "save the machine, resume later" possible. The conversation inside the brain is plain serializable data.

### The four wire shapes

These are the exact JSON objects on the wire, one per part type:

```json
{ "type": "text",        "text": "hello" }
{ "type": "image",       "source": { "encoding": "base64", "media_type": "image/png", "data": "…" } }
{ "type": "tool_call",   "id": "call_1", "name": "read_file", "input": { "path": "a.rs" } }
{ "type": "thinking",    "text": "…", "signature": "…" }
{ "type": "tool_result", "call_id": "call_1", "name": "read_file", "output": "…", "is_error": true }
```

Compare them against a saved session file when a provider complains about a payload.

`signature` and `redacted` serialize only when present, through `skip_serializing_if`. `retention` follows the same rule, so old saved conversations load unchanged.

One more default protects old data. `ToolResult.name` has a serde default of `""`, so conversations saved before the field existed still load. Do not rely on `name` being non-empty when you read foreign data.

`ToolContent` is untagged. `Text` serializes as a plain JSON string, and `Multipart` serializes as an array of `{"type":"text"|"image", …}` objects. Neither gets a wrapper. An empty `parts` list is legal, and it means silence.

Reader semantics carry one subtlety worth pinning. `text_content()` concatenates text parts with no separator, so consecutive text parts are one logical stream: `"a"` plus `"b"` gives `"ab"`.

`Display` differs on purpose. It joins with newlines and renders non-text parts as brackets, so `[Tool: read_file with input: {…}]`, `[Tool Result: …]` and `[Image: image/png]` all appear in logs. Log output and `text_content()` of the same message can legitimately differ.

One constructor is missing on purpose: there is no `Message::system()`. System-role messages are framework-built through `Message::new(Role::System, …)`, which is what contributors emit. Your code expresses standing guidance through the session's system prompt, where every provider routes it correctly.

## Retention classes

A tool result can carry a `Retention` tag. Set it with `MessagePart::tool_result(...).with_retention(...)`, or let your tool set it through `ToolOutput`. See [tools](/core-data/tools/) for that second path. When you tag a result, you decide what compaction may throw away.

| Class | Meaning | What compaction and pruning do with it |
|---|---|---|
| `None` | Default. The result carries no tag. | First to go. Old untagged results are exactly what the [prune](/engine/context-accounting/) pass clears. |
| `Requery` | Re-derivable. The model can fetch the content again, like a file read or a search hit. | Cleared after the untagged pool runs out. The omission marker names the tool call, so a summary cannot restate content it never saw. |
| `Durable` | Not re-derivable. Losing it loses information. | Exempt from pruning. Compaction summarizes these rather than deleting them where the tag is honored. |

The tag travels with the part through serialization, so a checkpointed conversation keeps its retention decisions.

## A mini conversation

Four messages show the whole model working together:

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

Notice that the tool result arrives as a `User` message carrying the `call_1` id you passed in. That is the pairing rule from earlier, in real code.

That is the entire model: five shapes (`Message`, `Role`, `MessagePart`, `ToolContent`, `ImageSource`) that every other subsystem builds on.

## Related pages

- [Tools](/core-data/tools/) covers where `ToolCall` requests come from and how results are produced.
- [The big idea](/start-here/the-big-idea/) covers where these messages live: history versus pending.
- [File reference: message.rs](/file-reference/message/)
