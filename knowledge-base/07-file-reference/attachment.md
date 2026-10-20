# src/attachment.rs

This file holds the data you pin so it survives any compactor. You get the `Attachment` trait, the `AttachmentStore`, and the `File`, `Memory`, and `Todo` built-ins. Added in 0.4.1.

## Key items

Your attachment implements three methods. `id()` returns a string unique in your store, conventionally `"{kind}:{slug}"`. `kind()` returns `AttachmentKind::File`, `Memory`, or `Todo`. `render()` returns a `MessagePart` that must be text, deterministic for the state you pinned, and never mutates through `&self`.

The kind drives ordering in `render_all`: memory leads, file follows, todo trails. The sort is stable, so pins made earlier keep their lead within a kind.

Use `FileAttachment::path_only(path)` when you pin a path, or `inline(path, contents)` when you pin contents. Inline contents you provide are bounded at `FILE_CONTENTS_LIMIT_BYTES`, 8 KiB, cut at a char boundary with a byte-count footer. Pass `truncate = false` to render verbatim at your own risk.

Call `MemoryAttachment::new(slug, memory)` for a pinned fact, or `TodoAttachment::new(items)` with `TodoItem::new(text, completed)` for the live task list.

Your store offers `insert`, `remove`, `contains`, `attachments`, `render_all`, and `consolidated_message`. When you insert with an id already stored, it replaces the old pin in place, which is the update path you use for a mutable attachment.

The loop wiring lives in `BareLoop`: `set_attachment`, `with_attachment`, `detach_attachment`, and `attachment_ids`.

## Behavior notes

An attachment you pin never enters the machine-owned history. It renders into one consolidated `User` message of per-turn transient context, the contributor path, so no compactor can see what you pinned. Nothing is lost by construction.

Parts re-ride each request you send, fresh from the store, so an attachment you update, such as a checked-off todo, renders its latest state next turn. A deterministic render keeps your request prefix byte-stable for provider prompt caching.

The cost flows through payload accounting. An attachment that eats the window defers the turn to compaction like a contributor. One larger than the provider serves at all is provider-dependent: the permissive serve, the rejecting die through the salvage retry.

An empty store builds no message, so the requests you send stay byte-identical without attachments.

Deep dive: [Attachments](../04-extensions/07-attachments.md).
