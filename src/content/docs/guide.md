---
title: "The loopctl Knowledge Base"
---

This is a complete, plain-language guide to loopctl, the Rust framework for building agents. An agent is a program where an AI model does multi-step work by calling tools you write.

This knowledge base is written for end users like you. Every concept is explained at first use, every abbreviation is decoded in the [Glossary](/glossary/), and every claim is grounded in the source code of the crate.

## Start here

If you are new to loopctl, read these four pages in order, because they build on each other. Once you finish them, you will know which section to open for any question you hit later:

1. **[What is loopctl?](/start-here/what-is-loopctl/)** covers the problem it solves, a working example in 20 lines, and the five ideas behind the design.
2. **[The big idea](/start-here/the-big-idea/)** covers the brain and hands split, the two buffers, and who decides what. It is the most important page here.
3. **[Anatomy of a run](/start-here/anatomy-of-a-run/)** traces one full run through every layer, step by step.
4. **[The codebase map](/start-here/codebase-map/)** lists every folder and file, one line each.

## The reference sections

| Section | What you find inside |
|---|---|
| **[01 Core data](/core-data/messages/)** | The vocabulary everything else uses: [messages](/core-data/messages/), [tools](/core-data/tools/), [tool selection](/core-data/tool-selection/), [the API client](/core-data/api-client/), [stream events](/core-data/stream-events/), [errors](/core-data/errors/), and [configuration](/core-data/session-config/) |
| **[02 The engine](/engine/state-machine/)** | How a run actually works: [state machine](/engine/state-machine/), [driver loop](/engine/driver-loop/), [LLM turn](/engine/llm-turn/), [tool dispatch](/engine/tool-dispatch/), [cancellation](/engine/cancellation/), [compaction](/engine/compaction/), [termination](/engine/termination/), [model switch](/engine/model-switch/), [context accounting](/engine/context-accounting/), [steering](/engine/steering/), and [history rewind](/engine/history-rewind/) |
| **[03 Safety systems](/safety/middleware/)** | Keeping your agent alive and harmless: [middleware](/safety/middleware/), [loop detection](/safety/loop-detection/), [convergence](/safety/convergence/), [model fallback](/safety/fallback/), [reflection and recovery](/safety/reflection/), [tool health](/safety/tool-health/), [safety shield](/safety/tool-shield/), [permissions](/safety/permission/), [approvals and grants](/safety/approvals/), and [the budget gate](/safety/budget-gate/) |
| **[04 Extensions](/extensions/observers/)** | Watching and shaping runs: [observers](/extensions/observers/), [hooks](/extensions/hooks/), [memory](/extensions/memory/), [contributors](/extensions/contributors/), [attachments](/extensions/attachments/), [the component bundle](/extensions/managers/), and [the event hub](/extensions/event-hub/) |
| **[05 Providers](/providers/overview/)** | Real models: [overview and features](/providers/overview/), [the OpenAI family](/providers/openai/), [Anthropic](/providers/anthropic/), [Gemini](/providers/gemini/), [Bedrock](/providers/bedrock/), [SSE](/providers/sse/), [grammar](/providers/grammar/), and [embeddings](/providers/embeddings/) |
| **[06 Integration](/integration/structured-output/)** | Structured answers and the wider world: [structured output](/integration/structured-output/), [MCP](/integration/mcp/), [the derive macro](/integration/derive-macro/), [presets](/integration/presets/), [testing](/integration/testing/), [the manifest](/integration/manifest/), and [loopctl-client](/integration/loopctl-client/) |
| **[07 File reference](/file-reference/)** | One page per source file, covering what it is, its key items, and its gotchas |
| **[08 Cookbook](/cookbook/gotchas/)** | [Every gotcha collected](/cookbook/gotchas/) and [18 complete recipes](/cookbook/recipes/) |
| **[09 Principles](/principles/sans-io/)** | The ideas under the hood, each explained from scratch: [sans-IO](/principles/sans-io/), [state machines](/principles/state-machines/), [tokens and context windows](/principles/tokens-and-context/), [soft and hard errors](/principles/soft-and-hard-errors/), [backoff and jitter](/principles/backoff-and-jitter/), [circuit breakers](/principles/circuit-breakers/), [windows, EWMA, and similarity](/principles/measuring-repetition/), [cooperative cancellation](/principles/cooperative-cancellation/), [caching and invalidation](/principles/caching-and-invalidation/), [rate limiting](/principles/rate-limiting/), [parallel waves](/principles/scheduling-parallel-work/), and [text matching](/principles/text-matching/) |

## Reading paths

### You want to build an agent today

Read [What is loopctl](/start-here/what-is-loopctl/), then [The big idea](/start-here/the-big-idea/), then [Tools](/core-data/tools/). After that go to [Recipes](/cookbook/recipes/) and start with recipes 1 through 3, then [Gotchas](/cookbook/gotchas/).

### Something went wrong and you want to know why

Read [Errors](/core-data/errors/), then [Termination](/engine/termination/), then the subsystem page for your symptom, whether that is compaction, fallback, or detection. Finish with [Gotchas](/cookbook/gotchas/).

### You are reading the source code

Read the [Codebase map](/start-here/codebase-map/), then the [File reference](/file-reference/), where every file has a page.

### You want the concepts, not the code

Read [The big idea](/start-here/the-big-idea/), then the [Principles](/principles/sans-io/) section in order, where each page stands alone. Then go back to any engine or safety page, which will now read like an old friend.

### You are going deep on the engine

Read [The big idea](/start-here/the-big-idea/), then [Sans-IO](/principles/sans-io/), then [state machines](/principles/state-machines/). After that take the state machine page, the driver loop, and the four mechanism pages on LLM turn, dispatch, cancellation, and compaction. Finish at [Termination](/engine/termination/).

### You are evaluating loopctl for production

Read [What is loopctl](/start-here/what-is-loopctl/), then the whole safety section, then the [Production hardening recipe](/cookbook/recipes/), and finally [Gotchas](/cookbook/gotchas/).

## About this knowledge base

These pages are grounded in source. They were written against loopctl `v0.4.1`, so every default value, threshold, and behavior stated here comes from the code or its tests.

They are plain by design. You get no unexplained jargon, short sentences, and every diagram can be read on its own.

They are honest about limits. Where the crate drops images, where defaults surprise you with zero retries, and where heuristics are only heuristics, it is all in the open, mostly in [Gotchas](/cookbook/gotchas/).

You can read these pages in any order once you know the four start-here pages. You can also cite them in your own docs, since each page names the file it describes.

For companion resources, see the crate's [API documentation on docs.rs](https://docs.rs/loopctl) for the item-level reference, its README for the feature matrix, and `TESTING.md` in the repository.
