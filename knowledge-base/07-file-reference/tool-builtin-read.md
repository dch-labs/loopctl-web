# `src/tool/builtin/read.rs` — `ReadTool` + `ContentSource` [feature: builtin_tools]

Line-aware reading over a pluggable source: the tool renders `cat -n`-numbered windows with continuation markers that name the next offset, and the `ContentSource` seam means the same tool reads any source a host defines — `FileSource` (in `fs.rs`) is the filesystem implementation, a remote tree source can serve it unchanged.

**Key items**

- `ReadTool<S: ContentSource>` — the tool (`Read`, CamelCase since 0.4.0). Numbered lines, truncation markers naming the next offset, a size-probe guard that refuses before reading oversized content.
- `ContentSource` — the seam: read content (bounded) through whatever backing store you define.
- `SourceContent` — the source's answer: text content, image payloads (multipart reads with an encoded-size ceiling), or a binary refusal.

**Behavior notes**

- The default window is right-sized for small context slots (0.4.0): 400 lines / 32,768 bytes of joined output (was 2,000 lines / 400 KB).
- Explicit registration only — no preset registers it; `default = []` unchanged.

Deep dive: [Tools](../01-core-data/02-tools.md) — the builtin families table.
