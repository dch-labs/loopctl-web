---
title: "The loopctl Knowledge Base"
---


A complete, plain-language guide to **loopctl** — the Rust framework for building agents: programs where an AI model does multi-step work by calling tools you write.

This knowledge base is written for **end users**. Every concept is explained at first use, every abbreviation is decoded (full list in the [Glossary](/glossary/)), and every claim is grounded in the source code of the crate.

---

## Start here

New to loopctl? Read these four pages in order — they build on each other:

1. **[What is loopctl?](/start-here/what-is-loopctl/)** — the problem it solves, a working example in 20 lines, the five ideas behind the design.
2. **[The big idea](/start-here/the-big-idea/)** — the brain/hands split, the two buffers, who decides what. *The most important page here.*
3. **[Anatomy of a run](/start-here/anatomy-of-a-run/)** — one full run traced through every layer, step by step.
4. **[The codebase map](/start-here/codebase-map/)** — every folder and file, one line each.

## The reference sections

| Section | What's inside |
|---|---|
| **[01 Core data](/core-data/messages/)** | The vocabulary everything else uses: [messages](/core-data/messages/) · [tools](/core-data/tools/) · [the API client](/core-data/api-client/) · [stream events](/core-data/stream-events/) · [errors](/core-data/errors/) · [configuration](/core-data/session-config/) |
| **[02 The engine](/engine/state-machine/)** | How a run actually works: [state machine](/engine/state-machine/) · [driver loop](/engine/driver-loop/) · [LLM turn](/engine/llm-turn/) · [tool dispatch](/engine/tool-dispatch/) · [cancellation](/engine/cancellation/) · [compaction](/engine/compaction/) · [termination](/engine/termination/) · [model switch](/engine/model-switch/) |
| **[03 Safety systems](/safety/middleware/)** | Keeping agents alive and harmless: [middleware](/safety/middleware/) · [loop detection](/safety/loop-detection/) · [convergence](/safety/convergence/) · [model fallback](/safety/fallback/) · [reflection & recovery](/safety/reflection/) · [tool health](/safety/tool-health/) · [safety shield](/safety/tool-shield/) · [permissions](/safety/permission/) |
| **[04 Extensions](/extensions/observers/)** | Watching and shaping runs: [observers](/extensions/observers/) · [hooks](/extensions/hooks/) · [memory](/extensions/memory/) · [contributors](/extensions/contributors/) · [the component bundle](/extensions/managers/) |
| **[05 Providers](/providers/overview/)** | Real models: [overview & features](/providers/overview/) · [OpenAI family](/providers/openai/) · [Anthropic](/providers/anthropic/) · [Gemini](/providers/gemini/) · [Bedrock](/providers/bedrock/) · [SSE](/providers/sse/) · [grammar](/providers/grammar/) |
| **[06 Integration](/integration/structured-output/)** | Structured answers and the wider world: [structured output](/integration/structured-output/) · [MCP](/integration/mcp/) · [derive macro](/integration/derive-macro/) · [presets](/integration/presets/) · [testing](/integration/testing/) |
| **[07 File reference](/file-reference/)** | One page per source file — what it is, its key items, its gotchas. |
| **[08 Cookbook](/cookbook/gotchas/)** | [Every gotcha collected](/cookbook/gotchas/) · [14 complete recipes](/cookbook/recipes/). |
| **[09 Principles](/principles/sans-io/)** | The ideas under the hood, each explained from scratch: [sans-IO](/principles/sans-io/) · [state machines](/principles/state-machines/) · [tokens & context windows](/principles/tokens-and-context/) · [soft vs hard errors](/principles/soft-and-hard-errors/) · [backoff & jitter](/principles/backoff-and-jitter/) · [circuit breakers](/principles/circuit-breakers/) · [windows, EWMA & similarity](/principles/measuring-repetition/) · [cooperative cancellation](/principles/cooperative-cancellation/) · [caching & invalidation](/principles/caching-and-invalidation/) · [rate limiting](/principles/rate-limiting/) · [parallel waves](/principles/scheduling-parallel-work/) · [text matching](/principles/text-matching/) |

## Reading paths

**"I want to build an agent today"**
What is loopctl → The big idea → Tools → [Recipes](/cookbook/recipes/) (start with 1–3) → [Gotchas](/cookbook/gotchas/).

**"Something went wrong — why?"**
[Errors](/core-data/errors/) → [Termination](/engine/termination/) → the subsystem page for your symptom (compaction, fallback, detection...) → [Gotchas](/cookbook/gotchas/).

**"I'm reading the source code"**
[Codebase map](/start-here/codebase-map/) → [File reference](/file-reference/) — every file has a page.

**"I want to understand how it works, conceptually"**
Big idea → the [Principles](/principles/sans-io/) section (in order — each page is standalone) → back to any engine or safety page, which will now read like an old friend.

**"I'm going deep on the engine"**
Big idea → [Sans-IO](/principles/sans-io/) → [state machines](/principles/state-machines/) → State machine → Driver loop → the four mechanism pages (LLM turn, dispatch, cancellation, compaction) → Termination.

**"I'm evaluating loopctl for production"**
What is loopctl → Safety section (all of it) → [Production hardening recipe](/cookbook/recipes/) → Gotchas.

---

## About this knowledge base

- **Grounded in source**: written against the loopctl codebase (v0.3.0) — every default value, threshold, and behavior stated here comes from the code or its tests.
- **Plain by design**: no unexplained jargon; short sentences; every diagram can be read on its own.
- **Honest about limits**: where the crate drops images, where defaults surprise (zero retries!), where heuristics are heuristics — it's all in the open, mostly in [Gotchas](/cookbook/gotchas/).

Companion resources: the crate's [API documentation on docs.rs](https://docs.rs/loopctl) (item-level reference), its README (feature matrix), and `TESTING.md` in the repository.
