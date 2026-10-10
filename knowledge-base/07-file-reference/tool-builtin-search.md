# `src/tool/builtin/search.rs` + `search/` — the search tool family [feature: search_tools]

Four tools over one seam: `GlobTool`, `GrepTool`, `CodeSearchTool`, `TreeTool` — registering as `Glob`, `Grep`, `CodeSearch`, `Tree` (CamelCase, 0.4.0) — all generic over `SearchSource`, with `FsSearchSource` as the shipped filesystem implementation. The seam exists so a remote tree source (a GitHub tree at a pinned revision) can serve the same tools unchanged. Submodules: `walk.rs` (the ignore-crate walker), `content.rs` (the shared `SearchJob` engine), `glob.rs` / `grep.rs` / `code_search.rs` / `tree.rs` (the tools), `output.rs` (rendering + the spill), `regex_cache.rs` (the process-global bounded LRU of compiled patterns), `resolve.rs` (lexical root resolution).

**Key items**

- Gitignore-aware walking: `.gitignore` inside git work trees, custom names `.loopctlignore` **and** `.dchignore` applied regardless of git, and an always-exclude list (`target/`, `node_modules/`, `.git/`, `__pycache__/`, …) that prunes even in non-git trees — directory nodes included.
- Content search: binary sniffing (extension list + NUL/control ratio), a 1 MiB per-file read ceiling, per-file and global match caps, include/exclude globs; patterns served from the LRU cache (case-folding folded into the key idempotently).
- Output shaping: oversized results spill to an owner-only, exclusively-created file under the context temp dir with a ~10 KiB preview and a Read-tool pointer (chunks bounded by the Read tool's own ceiling, so the pointer never names a file Read would refuse); inline truncation is the degrade path.

**Behavior notes**

- Roots resolve lexically against the context cwd (no filesystem probing, no tilde expansion); URL-shaped roots are `InvalidInput`s redirecting to a filesystem path.
- A present-but-wrong-typed field is an `InvalidInput` naming the field and expected type — never a silent default.
- Explicit registration only; `default = []` unchanged.

Deep dive: [Tools](../01-core-data/02-tools.md) — the builtin families table.
