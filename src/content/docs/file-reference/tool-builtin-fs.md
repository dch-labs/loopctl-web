---
title: "src/tool/builtin/fs.rs and fs/"
---

This file and its folder hold your write-class builtins: `WriteTool`, `EditTool`, `MultiEditTool`, `FileViewerTool`, and the `FileSource` implementation of `ContentSource`. You get them under the `fs_tools` feature.

Submodules under `fs/` are `write.rs`, `edit.rs`, `multi_edit.rs`, `file_viewer.rs`, and `file_source.rs`.

The machinery sits beside them: `atomic.rs` for atomic replace writes, `conflict.rs` for edit conflict detection, and `diff.rs` for the unified diffs you display, now with `@@` headers.

`resolve.rs` handles path resolution, containment, and the escape errors that teach. `existing.rs` is the shared guarded pre-reader, `match_repair.rs` is the edit miss classifier and whitespace-tolerant apply, and `state.rs` holds the per-session file session.

## Key items

The four tools register under their CamelCase names: `Write`, `Edit`, `MultiEdit`, and `FileViewer` (0.4.0).

`FileSource` is your filesystem `ContentSource`, shared with `ReadTool`.

`FileSession` is the shared per-session state this family coordinates through, covering read caches and write tracking. Since 0.4.1 it also carries `with_scratch_root(path)`, an opt-in temp-shaped escape valve honored only at or under your working directory. It gained `with_unrestricted_available()` too, which advertises the unrestricted remedy only when your host's mode exists.

## Behavior notes

Writes land atomically through a temp file plus rename. Edits carry conflict detection, and the `old text not found` shape errors are written for a small-model reader.

`FileViewer` renders paged windows in the Read tool's conventions, so your model sees one style across file tools.

`ValidationDiagnostic` is this family's lint-shaped feedback type.

Registration is explicit only. No preset registers the family, and `default = []` is unchanged.

Diff previews open each change region with a unified `@@ -old,count +new,count @@` header computed from the file's true 1-based positions since 0.4.1. Your model can address the change where it sits.

## Path-key aliases, accepted (0.4.1)

Session-history mining showed 45% of failed fs calls were pure key-spelling drift. Your model sends `file_path` to `Read`, `path` to `Write`, or per-edit targets missing from `MultiEdit`. The family now accepts the alias spellings while the advertised schemas stay canonical.

`Read` takes `path` or `file_path`, and canonical wins when both ride. `Write`, `Edit`, and `FileViewer` take `file_path` or `path`, canonical first and never last-one-in. `MultiEdit` accepts the per-edit `path`, and a top-level `file_path` serves as the batch default for edits that lack one, while a top-level `path` is no default.

A present-but-mistyped canonical key refuses with its type, so `{"file_path": 123, "path": "a"}` errors rather than silently serving the alias.

A still-missing path names the expected key, the accepted spellings, and the keys your input actually carried:

```text
Missing file_path for Write (got top-level keys: path; accepted: file_path, or path)
```

The echo you get is bounded at 512 bytes.

## Edit miss repair (0.4.1)

An `old_text` miss classifies and teaches instead of a bare refusal. Stale means the file's closest passage differs in content, and the first differing line is cited with both sides quoted. Whitespace-only means the text matches modulo indentation width, trailing whitespace, or line endings.

No similar passage means nothing resembles your text. A link pointing out names the real target.

The error echoes the file's actual lines around the best candidate window, 1-based and bounded at 16 lines and 2 KiB. Your model gets the re-read the old hints demanded.

A unique normalized match applies outright. The splice keeps your file's own indentation, line endings, and edge whitespace: a CRLF file stays CRLF, and each line inherits its aligned file line's indent characters.

The replacement re-indents uniformly by the window's delta. The receipt discloses the apply with `matched with normalized indentation`, and an ambiguous normalized match refuses with the count.

## Guarded pre-reads (0.4.1)

Every site that inspects old content before writing routes through one shared guarded reader in `existing.rs`. A metadata gate classifies absence, kind, and size before the open, so a FIFO is never opened and cannot park your dispatch.

The open is non-blocking on unix, and the read takes at most the cap plus one byte, where the cap is the Read tool's own 10 MiB figure.

`Write` degrades past the cap and onto special files it can atomically replace, landing with a `Changed: … (modified, previous content not read)` header and no diff body. It refuses a directory outright.

`Edit` and `MultiEdit` refuse past the cap and onto non-regular targets, naming the guard. Staleness checks treat non-regular, directory, and over-cap targets as `Changed`.

## Escape errors that teach (0.4.1)

Containment rejections keep their byte-identical first line and gain the repair. You see the boundary your policy holds to, the target's class among temp scratch, sibling workspace, system or dependency path, or traversal spelling, and the remedies your session actually has.

The scratch root appears only when configured, and the unrestricted mode only when your host declared it available. The scratch root validates before creating, through lexical normalization plus a symlink-aware walk, so `../` escapes and roots through outbound symlinks refuse.

Deep dive: [Tools](/core-data/tools/), the builtin families table.
