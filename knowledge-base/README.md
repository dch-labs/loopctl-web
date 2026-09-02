# The loopctl Knowledge Base

A complete, plain-language guide to **loopctl** — the Rust framework for building agents: programs where an AI model does multi-step work by calling tools you write.

This knowledge base is written for **end users**. Every concept is explained at first use, every abbreviation is decoded (full list in the [Glossary](GLOSSARY.md)), and every claim is grounded in the source code of the crate.

---

## Start here

New to loopctl? Read these four pages in order — they build on each other:

1. **[What is loopctl?](00-start-here/01-what-is-loopctl.md)** — the problem it solves, a working example in 20 lines, the five ideas behind the design.
2. **[The big idea](00-start-here/02-the-big-idea.md)** — the brain/hands split, the two buffers, who decides what. *The most important page here.*
3. **[Anatomy of a run](00-start-here/03-anatomy-of-a-run.md)** — one full run traced through every layer, step by step.
4. **[The codebase map](00-start-here/04-codebase-map.md)** — every folder and file, one line each.

## The reference sections

| Section | What's inside |
|---|---|
| **[01 Core data](01-core-data/01-messages.md)** | The vocabulary everything else uses: [messages](01-core-data/01-messages.md) · [tools](01-core-data/02-tools.md) · [the API client](01-core-data/03-api-client.md) · [stream events](01-core-data/04-stream-events.md) · [errors](01-core-data/05-errors.md) · [configuration](01-core-data/06-session-config.md) |
| **[02 The engine](02-engine/01-state-machine.md)** | How a run actually works: [state machine](02-engine/01-state-machine.md) · [driver loop](02-engine/02-driver-loop.md) · [LLM turn](02-engine/03-llm-turn.md) · [tool dispatch](02-engine/04-tool-dispatch.md) · [cancellation](02-engine/05-cancellation.md) · [compaction](02-engine/06-compaction.md) · [termination](02-engine/07-termination.md) · [model switch](02-engine/08-model-switch.md) |
| **[03 Safety systems](03-safety/01-middleware.md)** | Keeping agents alive and harmless: [middleware](03-safety/01-middleware.md) · [loop detection](03-safety/02-loop-detection.md) · [convergence](03-safety/03-convergence.md) · [model fallback](03-safety/04-fallback.md) · [reflection & recovery](03-safety/05-reflection.md) · [tool health](03-safety/06-tool-health.md) · [safety shield](03-safety/07-tool-shield.md) · [permissions](03-safety/08-permission.md) |
| **[04 Extensions](04-extensions/01-observers.md)** | Watching and shaping runs: [observers](04-extensions/01-observers.md) · [hooks](04-extensions/02-hooks.md) · [memory](04-extensions/03-memory.md) · [contributors](04-extensions/04-contributors.md) · [the component bundle](04-extensions/05-managers.md) |
| **[05 Providers](05-providers/01-overview.md)** | Real models: [overview & features](05-providers/01-overview.md) · [OpenAI family](05-providers/02-openai.md) · [Anthropic](05-providers/03-anthropic.md) · [Gemini](05-providers/04-gemini.md) · [Bedrock](05-providers/05-bedrock.md) · [SSE](05-providers/06-sse.md) · [grammar](05-providers/07-grammar.md) |
| **[06 Integration](06-integration/01-structured-output.md)** | Structured answers and the wider world: [structured output](06-integration/01-structured-output.md) · [MCP](06-integration/02-mcp.md) · [derive macro](06-integration/03-derive-macro.md) · [presets](06-integration/04-presets.md) · [testing](06-integration/05-testing.md) |
| **[07 File reference](07-file-reference/README.md)** | One page per source file — what it is, its key items, its gotchas. |
| **[08 Cookbook](08-cookbook/01-gotchas.md)** | [Every gotcha collected](08-cookbook/01-gotchas.md) · [14 complete recipes](08-cookbook/02-recipes.md). |
| **[09 Principles](09-principles/01-sans-io.md)** | The ideas under the hood, each explained from scratch: [sans-IO](09-principles/01-sans-io.md) · [state machines](09-principles/02-state-machines.md) · [tokens & context windows](09-principles/03-tokens-and-context.md) · [soft vs hard errors](09-principles/04-soft-and-hard-errors.md) · [backoff & jitter](09-principles/05-backoff-and-jitter.md) · [circuit breakers](09-principles/06-circuit-breakers.md) · [windows, EWMA & similarity](09-principles/07-measuring-repetition.md) · [cooperative cancellation](09-principles/08-cooperative-cancellation.md) · [caching & invalidation](09-principles/09-caching-and-invalidation.md) · [rate limiting](09-principles/10-rate-limiting.md) · [parallel waves](09-principles/11-scheduling-parallel-work.md) · [text matching](09-principles/12-text-matching.md) |

## Reading paths

**"I want to build an agent today"**
What is loopctl → The big idea → Tools → [Recipes](08-cookbook/02-recipes.md) (start with 1–3) → [Gotchas](08-cookbook/01-gotchas.md).

**"Something went wrong — why?"**
[Errors](01-core-data/05-errors.md) → [Termination](02-engine/07-termination.md) → the subsystem page for your symptom (compaction, fallback, detection...) → [Gotchas](08-cookbook/01-gotchas.md).

**"I'm reading the source code"**
[Codebase map](00-start-here/04-codebase-map.md) → [File reference](07-file-reference/README.md) — every file has a page.

**"I want to understand how it works, conceptually"**
Big idea → the [Principles](09-principles/01-sans-io.md) section (in order — each page is standalone) → back to any engine or safety page, which will now read like an old friend.

**"I'm going deep on the engine"**
Big idea → [Sans-IO](09-principles/01-sans-io.md) → [state machines](09-principles/02-state-machines.md) → State machine → Driver loop → the four mechanism pages (LLM turn, dispatch, cancellation, compaction) → Termination.

**"I'm evaluating loopctl for production"**
What is loopctl → Safety section (all of it) → [Production hardening recipe](08-cookbook/02-recipes.md) → Gotchas.

---

## About this knowledge base

- **Grounded in source**: written against the loopctl codebase (v0.3.0) — every default value, threshold, and behavior stated here comes from the code or its tests.
- **Plain by design**: no unexplained jargon; short sentences; every diagram can be read on its own.
- **Honest about limits**: where the crate drops images, where defaults surprise (zero retries!), where heuristics are heuristics — it's all in the open, mostly in [Gotchas](08-cookbook/01-gotchas.md).

Companion resources: the crate's [API documentation on docs.rs](https://docs.rs/loopctl) (item-level reference), its README (feature matrix), and `TESTING.md` in the repository.
