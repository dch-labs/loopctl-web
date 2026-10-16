---
title: "src/tool/builtin/fs.rs and fs/"
---

This file and its folder hold your write-class builtins: `WriteTool`, `EditTool`, `MultiEditTool`, `FileViewerTool`, and the `FileSource` implementation of `ContentSource`. You get them under the `fs_tools` feature.

Submodules under `fs/` are `write.rs`, `edit.rs`, `multi_edit.rs`, `file_viewer.rs`, and `file_source.rs`.

The machinery sits beside them: `atomic.rs` for atomic replace writes, `conflict.rs` for edit conflict detection, and `diff.rs` for unified diffs you display.

`resolve.rs` handles path resolution against the context cwd, and `state.rs` holds the per-session file session.

## Key items

The four tools register under their CamelCase names: `Write`, `Edit`, `MultiEdit`, and `FileViewer` (0.4.0).

`FileSource` is your filesystem `ContentSource`, shared with `ReadTool`.

`FileSession` is the shared per-session state this family coordinates through, covering read caches and write tracking.

## Behavior notes

Writes land atomically through a temp file plus rename. Edits carry conflict detection, and the `old text not found` shape errors are written for a small-model reader.

`FileViewer` renders paged windows in the Read tool's conventions, so your model sees one style across file tools.

`ValidationDiagnostic` is this family's lint-shaped feedback type.

Registration is explicit only. No preset registers the family, and `default = []` is unchanged.

Deep dive: [Tools](/core-data/tools/), the builtin families table.
