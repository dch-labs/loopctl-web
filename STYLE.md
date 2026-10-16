---
title: "Knowledge base style"
description: "How documentation in this repo is written. Applies to every page under src/content/docs."
---

# Knowledge base style

The bar is [docs.tinygrad.org](https://docs.tinygrad.org/): plain, short, declarative,
second person. Instructions and facts, not essays.

Every rule below is machine-checked. Run `npm run style` (see *Checking* at the end).

## Prose

| Rule | Limit |
| --- | --- |
| Words per sentence | target ≤ 17, never over 30 |
| Sentences over 40 words | zero, no exceptions |
| Words per paragraph | target ≤ 35 |
| Em-dashes (`—`) | 0 in prose. Use a full stop, or a colon |
| Semicolons joining clauses | 0. Full stop instead |
| Parentheticals of 6+ words | ≤ 3 per 1k words. If it needs brackets, it needs its own sentence |
| "you / your" | ≥ 15 per 1k words. Address the reader |
| Actionable verbs (can, must, run, set, pass) | ≥ 15 per 1k words |
| Sentence starts | vary them; no more than two in a row with the same opening word |

One idea per sentence. If a sentence contains "and" twice, it is two or three
sentences.

**Never fragment.** A sentence needs a verb. `default = []`, no optional
dependencies, Unix-only by design` is notes, not prose: "The crate has
`default = []`, no optional dependencies, and is Unix-only by design."

**Never telegraph.** Do not stack modifiers where a reader has to unpack them:

> one object-safe `LoopctlClient` interface consumed by every daemon-facing surface
> (the CLI's verbs, the TUI's attach/stream/approval, future third parties) — and
> implemented in-process

Write what it is, then who uses it, then what the alternative is. Three sentences.

## Structure

- Lead with one or two short paragraphs: what this is, who it is for. No preamble,
  no "in this page we will".
- Then the smallest working thing: a command, a call, a code block.
- Use a table when you have three or more items with the same shape (verbs, limits,
  events, settings). Use a list when the items differ from each other. Use prose
  when there are only two of something.
- Every code block gets one sentence before it saying what it is, and one after it
  saying what to notice. Never a code block orphaned between headings.
- Keep one idea per `##` section. A heading that contains "and" usually covers two
  sections.
- Long pages are fine; long *sentences* are not. Do not split a page to look tidy.

## Headings

Plain noun phrases. "The driver loop", not "The driver loop — the hands, job by
job". "Failure handling", not "Long runs die of small failures".

- Sentence case, no em-dashes, no colon-wordplay, no poetic inversion.
- Say what the section contains, in the words a reader would search for.
- `title` in frontmatter is the sidebar label, so this applies there too.

Headings own URL anchors, and 20 links in this corpus point at them. There is no
anchor pinning in this build. `## Retention classes {#retention-classes}` does not
work: rehype-slug folds the braces into the slug and Starlight prints them as
visible text. So when you rename a referenced heading, rename it and fix the links
that pointed at the old anchor.

`npm run style` reports any anchor that no longer resolves, so the fix is checked
rather than remembered.

## Voice

Direct and neutral, occasionally human. tinygrad gets away with "This petaflop is
your petaflop" because the sentences around it are plain. Earn one wry line per
page at most; never in the first paragraph.

Do not use: "simply", "just", "obviously", "merely", "note that", "it's worth
noting", "delve", "leverage", "robust", "seamless", "powerful". If it is simple,
saying so insults the reader.

Metaphors are load-bearing and expensive. "The brain owns what, the hands own how"
is fine once per page; do not narrate "the brain decides, the hands obey, the door
closes" for twenty paragraphs.

## Facts

Do not change what the code does. Every number, flag, type name, path, error
variant, feature name and version tag survives a rewrite. `npm run facts` diffs
the tokens of a batch against its pre-rewrite copy and fails on anything missing.

Version tags stay, as their own short sentence or a table column, not braided into
prose: "Added in 0.4.0." reads better than "(0.4.0, opt-in `set_prune`)" buried in
clause four.

### Tokens that stay lost

Some tokens do not come back. Re-adding them would undo the prose bar or restate a
fact the page already carries, so a facts run is not clean at zero:

- `e.g.` and `etc.`. The bar drops Latin abbreviations. Say "such as" instead.
- One `Instead` connective, absorbed into the sentence around it.
- `040`, four times. These are not version tags. They are the URL fragments of
  headings flattened on purpose, and anchors cannot be pinned in this build, so
  they cannot be recovered at all.
- `envelopes` and `TLS/HTTP/2` in `file-reference/client-crate.md`. One is now
  singular, the other now reads "no TLS, and no HTTP/2". Same facts, split.

The corpus sits at 18 flagged pages against the ported reference copy, 19 against
the site's own pre-rewrite text. That is the pass line. Treat a run above it as a
regression, and a run below it as a fact restored rather than noise cleared.

## Checking

```bash
npm run style   # sentence length, em-dashes, anchors, fragments
npm run facts -- <reference-dir> src/content/docs   # fact-token diff
```

`facts` takes two directories. Run bare, it prints usage and checks nothing, so a
bare run always passes. For the reference copy prefer the site's own earlier text
over any scratch copy: `git archive master src/content/docs | tar -x -C
/tmp/refbase`. The `knowledge-base/` tree in this repo is the pre-port source and
reads as different prose, so diff against it only deliberately.

Both scripts live in `scripts/`. A batch is done when both pass and
`npm run build` reports 175 pages.
