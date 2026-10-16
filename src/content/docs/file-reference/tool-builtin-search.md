---
title: "src/tool/builtin/search.rs"
sidebar:
  order: 40
---

This file and its `search/` directory hold four tools over one seam: `GlobTool`, `GrepTool`, `CodeSearchTool`, and `TreeTool`. They register as `Glob`, `Grep`, `CodeSearch`, and `Tree` in CamelCase since 0.4.0, and they sit behind the `search_tools` feature.

All four are generic over `SearchSource`, and `FsSearchSource` ships as the filesystem implementation. The seam exists so a remote tree source, such as a GitHub tree at a pinned revision, can serve your same tools unchanged.

The submodules split the work. `walk.rs` wraps the ignore-crate walker, and `content.rs` holds the shared `SearchJob` engine.

The tools themselves live in `glob.rs`, `grep.rs`, `code_search.rs`, and `tree.rs`. `output.rs` does rendering plus the spill, `regex_cache.rs` keeps the process-global bounded LRU of compiled patterns, and `resolve.rs` resolves lexical roots.

## Key items

Walking is gitignore-aware. `.gitignore` applies inside git work trees, and the custom names `.loopctlignore` and `.dchignore` apply regardless of git.

An always-exclude list covers `target/`, `node_modules/`, `.git/`, and `__pycache__/`, and it prunes even in your non-git trees, with directory nodes included.

Content search sniffs binaries through an extension list plus a NUL and control ratio, and it enforces a 1 MiB per-file read ceiling. Per-file and global match caps apply, and include and exclude globs narrow the walk.

Your patterns are served from the LRU cache, where case-folding is folded into the key idempotently.

Oversized results spill to an owner-only, exclusively-created file under the context temp dir, and you get a roughly 10 KiB preview plus a Read-tool pointer.

Those chunks are bounded by the Read tool's own ceiling, so the pointer never names a file your Read tool would refuse. Inline truncation is the degrade path.

## Behavior notes

Roots resolve lexically against your context cwd, with no filesystem probing and no tilde expansion. A URL-shaped root is an `InvalidInput` that redirects you to a filesystem path.

A present-but-wrong-typed field is an `InvalidInput` naming the field and the expected type, never a silent default.

Registration is explicit only, and `default = []` is unchanged.

For the deep dive, see the builtin families table in [Tools](/core-data/tools/).
