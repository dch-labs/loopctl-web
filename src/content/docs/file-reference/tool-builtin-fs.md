---
title: "`src/tool/builtin/fs.rs` + `fs/` — the filesystem tool family [feature: fs_tools]"
---


The write-class builtins: `WriteTool`, `EditTool`, `MultiEditTool`, `FileViewerTool`, and the `FileSource` implementation of `ContentSource`. Submodules under `fs/`: `write.rs`, `edit.rs`, `multi_edit.rs`, `file_viewer.rs`, `file_source.rs`, plus the machinery — `atomic.rs` (atomic replace writes), `conflict.rs` (edit conflict detection), `diff.rs` (unified diffs for display), `resolve.rs` (path resolution against the context cwd), `state.rs` (the per-session file session).

**Key items**

- The four tools register under their CamelCase names — `Write`, `Edit`, `MultiEdit`, `FileViewer` (0.4.0).
- `FileSource` — the filesystem `ContentSource`, shared with `ReadTool`.
- `FileSession` — the shared per-session state the family coordinates through (read caches, write tracking).

**Behavior notes**

- Writes land atomically (temp + rename); edits carry conflict detection (`old text not found` shape errors written for a small-model reader); `FileViewer` renders paged windows in the Read tool's conventions.
- `ValidationDiagnostic` — the family's lint-shaped feedback type.
- Explicit registration only; no preset registers the family; `default = []` unchanged.

Deep dive: [Tools](/core-data/tools/) — the builtin families table.
