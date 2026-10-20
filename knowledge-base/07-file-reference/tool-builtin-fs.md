# `src/tool/builtin/fs.rs` + `fs/` — the filesystem tool family [feature: fs_tools]

The write-class builtins: `WriteTool`, `EditTool`, `MultiEditTool`, `FileViewerTool`, and the `FileSource` implementation of `ContentSource`. Submodules under `fs/`: `write.rs`, `edit.rs`, `multi_edit.rs`, `file_viewer.rs`, `file_source.rs`, plus the machinery — `atomic.rs` (atomic replace writes), `conflict.rs` (edit conflict detection), `diff.rs` (unified diffs with `@@` headers), `resolve.rs` (path resolution, containment, and the escape errors that teach), `existing.rs` (the shared guarded pre-reader), `match_repair.rs` (edit miss classification and whitespace-tolerant apply), `state.rs` (the per-session file session).

**Key items**

- The four tools register under their CamelCase names — `Write`, `Edit`, `MultiEdit`, `FileViewer` (0.4.0).
- `FileSource` — the filesystem `ContentSource`, shared with `ReadTool`.
- `FileSession` — the shared per-session state the family coordinates through (read caches, write tracking, resolve policy). 0.4.1 adds `with_scratch_root(path)` (opt-in temp-shaped escape valve, honored only at or under the working directory) and `with_unrestricted_available()` (advertise the unrestricted remedy only when the host's mode exists).

**Behavior notes**

- Writes land atomically (temp + rename); edits carry conflict detection; `FileViewer` renders paged windows in the Read tool's conventions.
- `ValidationDiagnostic` — the family's lint-shaped feedback type.
- Explicit registration only; no preset registers the family; `default = []` unchanged.
- Diff previews open each change region with a unified `@@ -old,count +new,count @@` header computed from the file's true 1-based positions (0.4.1), so a reader can address the change where it sits.

**Path-key alias tolerance (0.4.1)**

Session-history mining showed 45% of failed fs calls were pure key-spelling drift: `file_path` sent to `Read`, `path` sent to `Write`, per-edit targets missing from `MultiEdit`. The family now accepts the alias spellings while the advertised schemas stay canonical:

- `Read` takes `path` (canonical) or `file_path`; canonical wins when both ride (a pre-parse canonicalization, not serde document order).
- `Write`/`Edit`/`FileViewer` take `file_path` (canonical) or `path`, canonical first, never last-one-in.
- `MultiEdit` accepts the per-edit `path` spelling, and a top-level `file_path` serves as the batch default for edits that lack one (a top-level `path` is no default). The advertised schema admits the root-default shape.
- A present-but-mistyped canonical key refuses with its type (`file_path must be a string, not number`) instead of silently serving the alias.
- A still-missing path names the expected key, the accepted spellings, and the keys the input actually carried: `Missing file_path for Write (got top-level keys: path; accepted: file_path, or path)`. The received-keys echo is bounded at 512 bytes. The shell's missing-`command` error carries the same shape.

**Edit miss repair (0.4.1)**

An `old_text` miss classifies and teaches, instead of a bare "not found":

- *stale* — the file's closest passage differs in content; the first differing line is cited with both sides quoted.
- *whitespace-only* — the text matches modulo indentation width, trailing whitespace, or line endings.
- *no similar passage* — nothing resembles the text.
- *link pointing out* — the target is a symlink leaving containment, with a real-target remedy.

The error echoes the file's actual lines around the best candidate window, 1-based, bounded (16 lines / 2 KiB) — the error becomes the re-read the old hints demanded. A *unique* normalized match applies outright through a core range that keeps the file's own indentation, line endings (`window_eol` keeps CRLF files CRLF), and edge whitespace; the replacement is re-indented uniformly by the window's delta, trims its own edges symmetric to the core, and each line inherits its aligned file line's indent characters wholesale. An unmappable repair refuses rather than guessing. The tolerant apply discloses itself in the receipt's note channel (`matched with normalized indentation`), and the overlap detector sees the same normalized ranges, so two edits overlapping only under normalization still abort before anything writes.

**Guarded pre-reads (0.4.1)**

Every site that inspects old content before writing routes through one shared guarded reader (`existing.rs`): a metadata gate classifies absence, kind, and size *before* the open (a FIFO is never opened and cannot park a dispatch), the open itself is non-blocking on unix, and the read takes at most the cap plus one byte. The cap is the Read tool's own 10 MiB figure. `Write` degrades past the cap and onto special files it can atomically replace (`Changed: … (modified, previous content not read)`, no diff body) but refuses a directory outright; `Edit`/`MultiEdit` refuse past the cap and onto non-regular targets naming the guard; the staleness checks treat non-regular, directory, and over-cap targets as `Changed`.

**Escape errors that teach (0.4.1)**

Containment rejections keep their byte-identical first line and gain the repair: the boundary the policy holds to, the target's class (temp scratch, sibling workspace, system or dependency path, traversal spelling), and the remedies that actually exist for the session — the scratch root only when configured, the unrestricted mode only when the host declared it available. The scratch root validates before creating (lexical normalization plus a symlink-aware walk; `../` escapes and roots through outbound symlinks refused).

Deep dive: [Tools](../01-core-data/02-tools.md) — the builtin families table.
