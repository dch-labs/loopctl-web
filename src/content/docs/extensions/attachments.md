---
title: "Attachments"
sidebar:
  order: 7
---

An **attachment** is data you pin so it rides every request, outside the conversation. The todo list, a fact from memory, the file your session is focused on: you render it into one user message of per-turn transient context. That is the same path [contributors](/extensions/contributors/) and memory transients ride.

The attachment never enters the machine-owned history at all. No compactor, truncating or summarizing, can even see it, so you never lose it. Added in 0.4.1. Source: `src/attachment.rs`.

## The trait and the built-ins

Implement three methods:

```rust
pub trait Attachment: Send + Sync {
    fn id(&self) -> String;             // "{kind}:{slug}", unique in the store
    fn kind(&self) -> AttachmentKind;   // File | Memory | Todo
    fn render(&self) -> MessagePart;    // must be a Text part, deterministic
}
```

Three kinds ship with the crate, and the kind drives ordering:

| Kind | Built-in | Ordering |
|---|---|---|
| `Memory` | `MemoryAttachment::new(slug, memory)` | leads the consolidated message |
| `File` | `FileAttachment::path_only(path)` or `inline(path, contents)` | follows |
| `Todo` | `TodoAttachment::new(items)` with `TodoItem::new(text, completed)` | trails |

Memories lead because the most durable context reads first. The live todo list trails because it is the most volatile. Pins made earlier keep their lead within a kind.

Your `render` must return a text part and be deterministic for a given state. The consolidated ride packs every part into one all-text user message, so a non-text part would ship as a separate adjacent user message. Providers that document alternating roles would not fold it.

Keep your render stable and the request prefix stays byte-stable across turns. That stability is what provider-side prompt caching depends on.

## Pin, replace, detach

Attachments live in an `AttachmentStore` the engine reads at every request build. You manage it through the loop:

```rust
let agent = BareLoop::new_with_managers(client, registry, config, managers)
    .with_attachment(Arc::new(TodoAttachment::new(todos)));

agent.set_attachment(Arc::new(updated));   // same id replaces in place
agent.detach_attachment("todo:session");   // or: detach_attachment(id) -> bool
let ids = agent.attachment_ids();          // what is pinned right now
```

Pinning an attachment whose `id` matches one already stored replaces it in place. That is the update path for a mutable attachment. Check off a todo item, re-pin your list, and the next request renders the latest state you hold.

An empty store builds no message, so an attachments-free loop keeps its requests byte-identical.

## The file ceiling

`FileAttachment::inline` bounds its contents at 8 KiB, cut at a char boundary with a byte-count footer. A host that pins a huge file cannot silently pin the whole window. Pass `truncate = false` to render verbatim at your own risk.

## Budget behavior

The token cost of pinned content flows through the existing payload accounting. An attachment that pushes the payload over the line defers the turn to compaction exactly like a contributor, and the reserve guarantees it still fits after shrinking.

One larger than the provider will serve at all is beyond any compactor's help. Attachments never enter the history a pass shrinks, so the outcome is provider-dependent.

A permissive backend keeps serving the deferred turns you pin. A rejecting one drives the turn through the salvage retry into the run's `ContextExceeded` death. Pin less than the window.

## Attachments versus the other per-turn context

Four paths inject per-turn context, and they differ in where content lives and what survives:

| Path | Enters history? | Survives compaction | Source of content |
|---|---|---|---|
| [Contributor](/extensions/contributors/) | never | re-computed each turn, so yes | your code |
| [Memory](/extensions/memory/) transients | never | retrieved fresh each turn | a store, by relevance |
| Attachment | never | yes, pinned verbatim | your code, host state |
| [Steering](/engine/steering/) | yes, committed | ages out with history | the user, mid-run |

Reach for an attachment when you need the content visible every turn in exact form. The live todo list, a fact the whole session depends on, and the focused file all qualify. Reach for a contributor when you compute the message, like today's date or a goal reminder.

## Gotchas

1. An attachment eats window every turn you run. The 8 KiB file ceiling exists because a pinned file is charged on every request you send. Re-pin as your session's focus moves instead of pinning everything.
2. Ids collide deliberately. Two attachments with equal ids are the same attachment, and the store keeps the newest you pinned, so namespace your ids by kind.
3. Render must not mutate. It takes `&self` and runs inside the request build. Do IO in your host code, then pin the result.

## Related pages

- [Contributors](/extensions/contributors/) is the computed-message counterpart.
- [Compaction](/engine/compaction/) covers the passes attachments never meet.
- [Context accounting](/engine/context-accounting/) explains how the pinned cost is counted.
- [File reference: attachment.rs](/file-reference/attachment/)
