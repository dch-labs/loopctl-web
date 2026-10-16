---
title: "Glossary, every word decoded"
---

This page decodes every abbreviation, jargon word, and loopctl-specific term used in this knowledge base.

When a definition mentions another term in italics, you will find that one defined here too.

Read an entry once, then go use the term in your own code. Each row names the thing, tells you what it does inside your run, and points deeper when the mechanism earns a page of its own.

Skip the words you already own. Expect the tables to repeat a term twice on purpose, once as a provider word and once as a loopctl word.

The same noun often behaves differently in those two places.


## Abbreviations

| Abbreviation | Full form | What it means here |
|---|---|---|
| **API** | Application Programming Interface | The network service you call to reach a model. Any program's defined interface counts too. |
| **LLM** | Large Language Model | The AI model itself, whether GPT, Claude, Gemini, Llama, GLM, or Kimi. |
| **IO** | Input/Output | Anything your program does to the outside world, such as network, disk, or processes. The engine's brain does none, and that is the sans-IO rule. |
| **SSE** | Server-Sent Events | A web standard where a server keeps a connection open and pushes text lines. Most providers stream your replies this way. |
| **JSON** | JavaScript Object Notation | The text format for structured data, like `{"key": "value"}`. Your model's arguments and your tool results travel as JSON. |
| **JSON Schema** | Not an abbreviation | A JSON document that describes the shape of other JSON, meaning which fields and what types. You write schemas so your model can learn a tool's arguments. |
| **MCP** | Model Context Protocol | An open standard connecting AI apps to tools. Servers expose tools and clients call them, and loopctl speaks both sides. |
| **UUID** | Universally Unique Identifier | A random 128-bit id like `550e8400-e29b-...`. You get one for each of your sessions, runs, and memory entries. |
| **HTTP** | HyperText Transfer Protocol | The web's request and response protocol, and model APIs run over it. Status codes tell you who failed: 4xx is your side, 5xx is the server, and 429 means slow down. |
| **TLS** | Transport Layer Security | The encryption that sits under HTTPS. |
| **SIGHUP and Ctrl-C** | Not an abbreviation | Ways a user or your OS asks a program to stop. loopctl handles them through the cancel signal. |
| **EWMA** | Exponentially Weighted Moving Average | An average where recent samples count more than old ones. Your tool health scores use it. |
| **LCS** | Longest Common Subsequence | A string-similarity measure, used for the did-you-mean tool-name suggestions you see. |
| **TTL** | Time To Live | How long a cache entry stays valid. In loopctl's memoizer you count it in *turns*, not seconds. |
| **STS and IRSA** | AWS credential mechanisms | Ways AWS rotates temporary credentials, and the Bedrock client supports hot-swapping them on you. |
| **PAT** | Personal Access Token | A long-lived API key, such as GitHub `ghp_...` or GitLab `glpat-...`. Your redaction layer scrubs these. |
| **PEM** | Privacy-Enhanced Mail format | The `-----BEGIN PRIVATE KEY-----` block format, which the redaction layer scrubs. |
| **vLLM** | Not an abbreviation | A popular local model inference server. It supports *grammar-constrained* decoding through `guided_json`. |
| **GBNF** | GGML BNF | A grammar format for llama.cpp-family samplers, and it is a dialect you could target with `ToolGrammarProvider`. |

## Agent words

| Term | Meaning |
|---|---|
| **Agent** | A program where your model does multi-step work by calling tools in a loop. |
| **Run** | One complete `run("...")` call. You pass input, you get turns, and it ends in a final answer or an error. |
| **Turn** | One ask-and-reply round with your model. A run usually has several. |
| **Session** | One agent instance, meaning its settings plus the history of all its runs. |
| **Tool** | A function your model can ask your program to run. |
| **Tool call** | Your model's request to run tool X with arguments Y. |
| **Tool result** | Your program's answer to a tool call, which loopctl feeds back to your model. |
| **Context and conversation** | The message list you send to your model each turn, which is everything it can see. |
| **Context window** | The hard limit in tokens on what your model can read per request. |
| **Token** | A small text chunk of about 4 characters. Providers bill you and cap you in tokens. |
| **Compaction** | Rewriting a too-long conversation into a shorter equivalent, whether a summary or a trim, so your run continues. |
| **Streaming** | Receiving the reply piece by piece as it is produced. |
| **Delta** | One streamed fragment of a reply. |
| **Stop reason** | Why your model stopped, whether end of turn, wants tools, hit a length cap, or hit a stop sequence. |
| **System prompt** | Standing instructions that frame every turn, such as "You are a...". |
| **Fallback** | Automatically switching to a backup model when your primary keeps failing. |

## loopctl architecture words

| Term | Meaning |
|---|---|
| **Engine** | The loop implementation, which is the brain plus the hands. |
| **Brain, or `LoopMachine`** | The pure state machine that decides each step. It does no IO and you can serialize it. |
| **Driver, or `BareLoop`** | The IO-doing half that executes your brain's steps. |
| **Sans-IO** | Literally "without input/output", and it is the design rule that keeps your brain pure data. |
| **`MachineStep`** | Your brain's instruction, which is `CallLLM`, `CallTools`, `Compact`, or `Done`. |
| **`MachineState`** | What your brain awaits: a model reply, tool results, compaction, or nothing at all in a terminal state. |
| **`MachinePolicy`** | The settings you hand to the brain per step, such as max turns, window, and thresholds. |
| **`history`** | The notebook. It holds messages of past successful runs, and it is durable across your runs. |
| **`pending`** | The scratchpad. It holds your current run's messages, and since 0.4.0 the coherent prefix is salvaged on a cancel or failure, while only the overflow family discards it whole. |
| **`finalize()`** | The single exit door every run passes through, where it commits or discards, records, notifies, and re-arms. |
| **Soft error** | A failure reported inside your run as tool-result text, so your model sees it, adapts, and the run continues. |
| **Hard error** | A failure that ends your run as a `LoopError`. |
| **Circuit breaker** | A switch that stops calling something that keeps failing, and probes it occasionally to see whether it recovered. |
| **Fallback chain** | The ordered list of backup models you can fall through. |
| **Middleware** | A stackable layer around your tool calls, such as a timeout, a cap, or a cache. |
| **Pipeline** | Your middleware chain plus the registry core at its center. |
| **Observer** | A read-only watcher of engine events. |
| **Hook** | A watcher with veto power, so it can block tool calls and compaction. |
| **Contributor** | A per-turn message injector, such as a goal reminder, and what it adds is never persisted. |
| **Memory** | A long-term store your agent reads from and writes to across turns. |
| **Reflector** | The analyzer of a failed tool call, asking what went wrong and whether it is recoverable. |
| **Recovery strategy** | The decider after a failure, whether to retry, skip, ask, or fail. |
| **Correction** | A machine-usable fix from reflection, meaning replaced input or a swapped tool. |
| **Compactor** | The strategy for how you shrink a conversation. |
| **`ContextManager`** | The owner of your compactor and sizing policy, meaning window, threshold, target, and token counter. |
| **Token counter** | The estimator that turns your messages into approximate token counts. |
| **Cancellation signal** | The shared flag that stops your run cooperatively at the next checkpoint. |
| **Cancel re-arm** | Re-setting that signal after a run, so one cancel does not kill your agent forever. |
| **Audit trail** | `session.runs`, the append-only record of every run and turn, which compaction never touches. |
| **Trajectory record** | A whole-run snapshot captured by the built-in `TrajectoryObserver`, covering per-turn queries and responses, tool calls, durations, tokens, and the outcome. Note that `MemoryCategory::Trajectory` is a different thing, since it is a memory entry about one tool call. |
| **Memory extraction** | Mining reusable lessons, such as strategies, error recoveries, and wasted calls, out of your recorded runs and storing them as memories, so your agent learns from experience. |
| **Consolidation** | A curation pass over your memory store that decays stale relevance, merges near-duplicates, and prunes what is neither fresh nor useful. |
| **Half-life decay** | Exponential forgetting, where relevance halves for each half-life of unaccessed age, which defaults to 14 days, weighted by category, so facts fade slower than working memory. |
| **Quality score** | The composite that decides what a consolidation pass keeps, combining relevance, access history, recency, and validated trust. |
| **Jaccard similarity** | Shared tokens over all tokens, and it is the cheap text-overlap measure your store uses to detect near-duplicate memories. |
| **Access stamp** | The record a matched retrieval leaves on a memory entry through `access_count` and `last_accessed`, which the next consolidation folds in, and that is what makes retrieved memories resist decay. |
| **Provider-derived memory** | A memory authored by the LLM extraction pass, tagged `provider-derived` and excluded from injection by default, because it is untrusted model output rather than verified fact. |
| **File-backed store** | `FileMemoryStore`, which persists your memory as one JSON line per entry so it survives process restarts. It is single-process and sits behind the `file_memory` feature. |
| **loopctl-sqlite** | The companion crate that gives you the same memory contract over a WAL-mode SQLite database, which buys multi-process durability and durable access stamps. |
| **Loop detection** | Noticing that the same tool operation, meaning name, argument, and result, keeps repeating on you. |
| **Convergence detection** | Noticing that your model's final answers are becoming near-identical. |
| **Shield** | A risk scorer that can block dangerous tool input before it runs. |
| **Overhead tokens** | The reserved cost of your system prompt and tool schemas in context estimates. |
| **No-progress guard** | The rule that ends a run when compaction shaves nothing, instead of looping forever. |
| **Emergency line** | The always-on compaction trigger at 95% of your window. |
| **Preresolved result** | An answer your brain fills in itself, such as "tool not available", without dispatching. |
| **Attempt reset** | The stream handler's signal that everything buffered from the failed attempt is void. |
| **Think tool** | A built-in no-side-effect scratchpad, `ThinkTool`, that your model reasons into before acting, and whose description teaches the procedure of restating the goal, weighing options, checking, and deciding. |
| **Prompted structured output** | Getting structured JSON from providers without native support, where the schema rides in your system prompt and a lenient scanner plus one corrective retry fish the answer out. |
| **Ratio token counter** | The `RatioTokenCounter` preset, which estimates tokens from a per-provider chars-per-token ratio plus per-message overhead, and it is the calibrated alternative to the default heuristic. |
| **Embedding** | Text as a vector of numbers, positioned so similar meanings sit close together, which is the basis of semantic retrieval. |
| **Vector index** | A nearest-neighbour store over your embeddings: you add vectors and get the top-k closest back, as in `VectorIndex`. |
| **Window probe** | The run-start question of how big your model's context really is. It is answered from llama.cpp `/props` or Ollama `/api/show` when the server discloses it, and the disclosure outranks your declared `context_window`. |
| **Calibration ratio** | The rolling correction in basis points between estimated and provider-reported input tokens, and that figure keeps your estimates honest on backends that report usage. |
| **Context figure** | The engine's current context-size number, either anchored on a real reported `input_tokens` plus an estimated tail, or a pure estimate. `RunEndContext.context_figure` tells you which one drove your last trigger. |
| **Prune** | The no-LLM reclamation pass, where old tool results beyond a protected tail are replaced by a `[cleared: prior tool output]` marker and the originals are handed to the demotion sink, so you free context without a summarizer call. |
| **Overflow salvage** | Surviving a "prompt too long" rejection, where the failed turn gets one compact-and-retry against a target strictly under the refused payload instead of your run dying. |
| **Demotion sink** | Where your compaction's evicted messages go instead of the void, typically a memory store, so evicted content stays recallable by your model. |
| **Retention class** | The per-tool-result tag of `Durable`, `Requery`, or the default, which decides what your pruning and compaction may clear and in what order. |
| **Rolling compactor** | A compactor that re-processes only the messages since the last pass, so compaction becomes a maintenance cadence rather than one big rewrite. |
| **QA summarizer** | The three-step LLM compactor that summarizes the about-to-drop slice, questions what is missing, and answers from the transcript before it is discarded. |
| **Structured summarizer** | The LLM compactor that emits sectioned summaries for facts, decisions, pending work, and questions, with contractually stable headings. |
| **Fallback compactor chain** | The never-fail compaction chain, which runs quality-descending stages of QA, then structured, then truncate, and whose terminal `TruncatingCompactor` cannot fail, so the chain never fails to compact. |
| **Terminal capture** | The chain's guarantee-floor wrapper, where the last-resort truncate always preserves at least `terminal_min_recent` recent messages. |
| **Landing target** | The post-compaction size a pass must actually reach, which defaults to 15% of your trigger threshold rather than the old 70%-of-threshold share. |
| **Gate decision** | One permission decision as serializable data: tool, args digest, verdict, rule id and source, reason, and timestamp. You get one record per gated dispatch, and you can join them by `call_id`. |
| **Args digest** | A 16-hex fingerprint of a tool call's arguments over canonical key-sorted JSON, which identifies the call without storing its content. |
| **Ask channel** | The external-approver mechanism, where a hook's `ask` parks your run at the pre-execution boundary and an async answer, a timeout, or a cancel resumes it. |
| **Grant** | A persisted approval rule such as "allow `Read` on exactly these arguments", with a narrow scope ladder and a pinned tool-descriptor digest, so re-asking is automatic when the tool changes. |
| **Budget gate** | The engine-side spend guard, where soft lines warn once per dimension through `on_budget_warn` and the hard line refuses your next request with `BudgetExhausted`, so budgets are gates. |
| **Soft line and hard line** | The budget gate's two thresholds per dimension: crossing soft warns you once, and crossing hard stops your next request before it is sent. |
| **Event hub** | `EventHub`, one `LoopObserver` that fans every engine event into a broadcast `LoopEvent` stream your CLI/TUI can subscribe to. |
| **Event ledger** | The per-event JSONL stream of `events.jsonl` and `TrajectoryEvent` records, which is your ordered, replayable event spine. |
| **Determinism seams** | The injectable `Clock`, `IdGen`, and `Rng` traits: you swap in a fixed clock and seeded generators, and the same run produces the same bytes. |
| **Manifest** | The `loop.yaml` document, which is a loop's declarative center. Your profiles deep-merge, your `${VAR}` references interpolate, validation reports spans, and one `config_hash` identifies the resolved shape. |
| **Cassette** | A recorded real HTTP exchange, meaning request, response, and streamed events, scrubbed and replayed hermetically in your tests, so the wire is the oracle. |
| **Golden request bytes** | Committed canonical-JSON files that pin exactly what the engine builds per scenario, so a red golden can only mean your own construction drifted. |
| **ContentSource** | The read seam, where `ReadTool` reads through any source you define, whether files or remote trees, and `FileSource` ships as the filesystem implementation. |
| **SearchSource** | The search seam, which is a `ContentSource` that can also walk entries, sniff binaries, and bound reads, so one trait serves your `Glob`, `Grep`, `CodeSearch`, and `Tree`. |

## Design and pattern words

These terms come from the [Principles](/principles/sans-io/) pages, which cover the patterns and small algorithms the crate is built from.

| Term | Meaning |
|---|---|
| **State machine** | A system described by a fixed set of named situations, called states, and allowed moves, called transitions, so everything else is forbidden by construction. |
| **Transition** | One allowed move between states, caused by one event or input. |
| **Terminal state** | A state with no outgoing transitions, so once you enter it you hold it forever, as a finished run does. |
| **Pure, or pure core** | Something that depends on nothing outside its inputs and changes nothing outside its outputs, so you get the same answer every time. |
| **Deterministic** | Same inputs always produce the same behavior, with no randomness, clock, or network in the deciding path. |
| **Pure core and imperative shell** | The general sans-IO shape, where decisions live in pure data and all the doing lives in a shell around it. |
| **Tokenization** | Splitting text into the fixed-vocabulary chunks a model actually reads, which is why 4 characters approximate 1 token and why exact counts are model-specific. |
| **Heuristic** | A cheap rule of thumb that is wrong sometimes on purpose, in a known direction, as when your token estimator errs high. |
| **Fingerprint, or hash** | A small number that summarizes a larger value, so equal values give equal fingerprints and you can compare fingerprints instead of whole outputs. |
| **Sliding window** | Keeping only the last N things, which is a queue that drops the oldest, so only the recent past counts. |
| **Jaccard similarity** | The size of two word-sets' overlap divided by their union, so it tells you what fraction of the words are shared, from 0.0 to 1.0. |
| **Thundering herd** | Many clients reacting to the same failure in lockstep, such as retrying simultaneously, re-creating the overload, and jitter and probes cure it. |
| **Idempotent** | Doing it twice has the same effect as once, and that is the property that makes an operation safe for you to retry. |
| **Half-open, or probe** | A circuit breaker's experiment state, where exactly one call is let through to test whether the target recovered. |
| **One-shot signal** | A signal that stays fired once it fires, so "reset" means swapping in a fresh one, never un-firing the old one. |
| **Canonical form** | One agreed spelling for every equivalent input, so `{"a":1,"b":2}` and `{"b":2,"a":1}` become the same bytes and equivalence becomes equality. |
| **Epoch guard** | A counter that advances on each invalidation, where work captures it before running and drops its result if it moved, which closes the "invalidated while I was computing" race. |
| **Wave, in dispatch** | A group of tool calls proven safe to run at the same time; waves execute one after another and calls within a wave run concurrently. |
| **Lane, in a stream** | One interleaved content channel inside a single streamed reply, whether text, thinking, or one tool call, identified by its index, so fragments route to slots by kind and index. |
| **Determinism seam** | The general shape behind `Clock`, `IdGen`, and `Rng`, where every nondeterministic input enters through a trait you can replace, so "same run, same bytes" becomes testable. |
| **Park and resume** | Suspending a run at a safe boundary with nothing in flight and state coherent, then continuing it later from an external answer, which is the ask channel's lifecycle. |
| **Landing verification** | Checking the result of an operation against the target it promised, such as post-compaction size against your landing target, rather than trusting the operator's self-report. |

## Provider words

| Term | Meaning |
|---|---|
| **ApiClient** | loopctl's one trait for talking to any model provider you point it at. |
| **Profile builder** | The middle tier of provider setup, such as `ollama_builder()` or `azure_builder(resource)`. It is a client builder with a provider's endpoint, env-var, and model facts pre-seeded, so a config-driven host overrides instead of duplicating. |
| **`StreamRequest`** | The outbound bundle of your messages plus an optional system prompt and tools. |
| **`RequestOptions`** | The per-request extras you set: a model override, a response format, or a tool constraint. |
| **Response format** | A forced JSON shape for your reply, meaning "answer as this schema". |
| **Tool constraint** | How strictly your tool schemas are enforced, whether none, strict, or grammar. |
| **Rate limit and 429** | The provider telling you it saw too many requests and you should wait. `Retry-After` is its hint for how long. |
| **Retry ladder** | The ordered retry logic, covering backoff growth, ceilings, and escalation. |
| **Backoff** | Waiting longer between each retry, which is exponential by default. |
| **Jitter** | Random variation you add to backoff so many clients do not retry in lockstep. |
| **Token bucket** | A rate-limiting container where requests take tokens and tokens refill at a set rate. |
| **Truncation, in a stream** | A stream that died before its terminal event, which is reported honestly and retried. |
| **Thinking, or reasoning** | Your model's private scratch reasoning, which is streamed separately and never lands in the final message. |
| **SigV4** | AWS's request-signing scheme, which Bedrock uses. |
| **Event-stream, in AWS** | Bedrock's binary framing for streamed replies, which is not SSE. |
| **Converse API** | Bedrock's cross-model request shape, which is the non-Anthropic path. |
| **Guided JSON** | vLLM's field for grammar-constrained output. |
| **Prompt-cache breakpoint** | A `cache_control` marker on the Anthropic wire asking the provider to cache your request prefix, and loopctl marks the last tool definition, the system prompt, and the tail blocks. |
| **Cached input tokens** | The share of your input count the provider served from its prompt cache, reported as `Usage::cached_input_tokens`, and it is the hit-rate number your cache actually pays for. |
| **Thinking effort** | The off, low, medium, high, or max knob at `RequestOptions::effort` that tells a reasoning model how much thinking to spend. |
| **Session-scoped reasoning retention** | Prior turns' thinking blocks ride the conversation verbatim until compaction ages them out, so your request prefix stays byte-stable and provider prompt caches keep hitting. |
| **Embedder** | A real `EmbeddingProvider` backend, whether `OllamaEmbedder` for local `/api/embed` or `OpenAiEmbedder` for `/v1/embeddings`. |

## Rust words used here

| Term | Meaning |
|---|---|
| **Trait** | An interface, meaning a set of methods a type can promise to implement. |
| **`Arc`** | Atomic Reference Counted, which is a shareable owner of a value across threads. |
| **`Mutex`** | A lock that ensures one thread at a time touches your data. |
| **Poisoned lock** | A lock left locked by a panicking thread, which loopctl treats as an error or recovers from by policy. |
| **`async` and `await`** | Rust's way to write concurrent code that waits without blocking a thread. |
| **`Future`** | A value representing work that will finish later. |
| **`Pin<Box<...>>`** | A heap-allocated, address-stable future, which is how object-safe async traits return their work. |
| **`serde`** | Rust's standard serialization library, and here it moves your data to/from JSON. |
| **Serde round-trip** | Serializing and then deserializing, which is how your saved machine resumes exactly. |
| **`#[non_exhaustive]`** | A promise that more variants may be added later, so your `match` needs a `_` arm. |
| **`catch_unwind`** | Catching a panic and turning it into a normal error, which is how your tool panics are isolated. |
| **Derive macro** | Code generation triggered by `#[derive(...)]`, as in `#[derive(Tool)]`. |
| **Cargo feature** | A compile-time switch that turns optional code on, as in `features = ["streaming"]`. |
| **`tokio::select!`** | Racing futures, where "biased" means the branches are polled in the written order, so your cancel branch goes first. |
| **`#[must_use]`** | A lint that says ignoring this return value is probably a bug on your side. |
| **Object safety** | A trait usable as `dyn Trait`, boxed with its concrete type erased, and all of loopctl's plugin traits are object safe so you can box them. |
