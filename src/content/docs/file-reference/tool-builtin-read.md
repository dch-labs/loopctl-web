---
title: "src/tool/builtin/read.rs"
---

This file gives you line-aware reading over a pluggable source, under the `builtin_tools` feature. The tool hands you `cat -n`-numbered windows with continuation markers that name your next offset.

The `ContentSource` seam means the same tool reads any source a host defines. `FileSource`, in `fs.rs`, is the filesystem implementation, and a remote tree source can serve it unchanged.

## Key items

`ReadTool<S: ContentSource>` is the tool, named `Read` and CamelCase since 0.4.0. It numbers lines and adds truncation markers naming the next offset.

It also runs a size-probe guard that refuses before reading oversized content.

`ContentSource` is your seam: read content, bounded, through whatever backing store you define.

`SourceContent` is your source's answer. It carries text content, image payloads for multipart reads with an encoded-size ceiling, or a binary refusal.

## Behavior notes

Your default window was right-sized for small context slots in 0.4.0, at 400 lines or 32,768 bytes of joined output, down from 2,000 lines and 400 KB.

You register it explicitly, since no preset registers it, and `default = []` is unchanged.

For the deep dive, see the builtin families table in [Tools](/core-data/tools/).
