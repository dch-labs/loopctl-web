---
title: "Glossary — every word, decoded"
---


Every abbreviation, jargon word, and loopctl-specific term used in this knowledge base, in plain language. Terms in *italics* inside a definition are defined here too.

---

## Abbreviations

| Abbreviation | Full form | What it means here |
|---|---|---|
| **API** | Application Programming Interface | The network service you call to reach a model (or any program's defined interface). |
| **LLM** | Large Language Model | The AI model itself — GPT, Claude, Gemini, Llama, GLM, Kimi... |
| **IO** | Input/Output | Anything a program does to the outside world: network, disk, processes. The engine's "brain" does none ("sans-IO"). |
| **SSE** | Server-Sent Events | A web standard where a server keeps a connection open and pushes text lines — how most providers stream replies. |
| **JSON** | JavaScript Object Notation | The text format for structured data: `{"key": "value"}`. Model arguments and tool results travel as JSON. |
| **JSON Schema** | — | A JSON document describing the *shape* of other JSON (which fields, what types). Models read schemas to learn a tool's arguments. |
| **MCP** | Model Context Protocol | An open standard connecting AI apps to tools: servers expose tools, clients call them. loopctl speaks both sides. |
| **UUID** | Universally Unique Identifier | A random 128-bit id like `550e8400-e29b-...` — used for sessions, runs, memory entries. |
| **HTTP** | HyperText Transfer Protocol | The web's request/response protocol; model APIs run over it. Status codes: 4xx = your side's fault, 5xx = the server's fault, 429 = "slow down". |
| **TLS** | Transport Layer Security | The encryption under HTTPS. |
| **SIGHUP / Ctrl-C** | — | Ways a user or OS asks a program to stop — handled via the cancel signal. |
| **EWMA** | Exponentially Weighted Moving Average | An average where recent samples count more than old ones (used in tool health scores). |
| **LCS** | Longest Common Subsequence | A string-similarity measure (used for "did you mean...?" tool-name suggestions). |
| **TTL** | Time To Live | How long a cache entry stays valid — in loopctl's memoizer, measured in *turns*, not seconds. |
| **STS / IRSA** | AWS credential mechanisms | Ways AWS rotates temporary credentials — the Bedrock client supports hot-swapping them. |
| **PAT** | Personal Access Token | A long-lived API key (GitHub `ghp_...`, GitLab `glpat-...`) — the redaction layer scrubs these. |
| **PEM** | Privacy-Enhanced Mail (format) | The `-----BEGIN PRIVATE KEY-----` block format — redacted by the redaction layer. |
| **vLLM** | — | A popular local model inference server; supports *grammar-constrained* decoding via `guided_json`. |
| **GBNF** | GGML BNF | A grammar format for llama.cpp-family samplers (a dialect you could target with `ToolGrammarProvider`). |

## Agent words

| Term | Meaning |
|---|---|
| **Agent** | A program where a model does multi-step work by calling tools in a loop. |
| **Run** | One complete `run("...")` call: input → turns → final answer or error. |
| **Turn** | One ask-reply round with the model. A run usually has several. |
| **Session** | One agent instance: settings + the history of all its runs. |
| **Tool** | A function the model can ask your program to run. |
| **Tool call** | The model's request: "run tool X with arguments Y." |
| **Tool result** | Your program's answer to a tool call, fed back to the model. |
| **Context / conversation** | The message list sent to the model each turn — everything it can "see." |
| **Context window** | The hard limit (in tokens) on what the model can read per request. |
| **Token** | A small text chunk (~4 characters). Providers bill and limit in tokens. |
| **Compaction** | Rewriting a too-long conversation into a shorter equivalent (summary or trim) so the run continues. |
| **Streaming** | Receiving the reply piece by piece as it's produced. |
| **Delta** | One streamed fragment of a reply. |
| **Stop reason** | Why the model stopped: end of turn, wants tools, hit a length cap, hit a stop sequence. |
| **System prompt** | Standing instructions that frame every turn ("You are a..."). |
| **Fallback** | Automatically switching to a backup model when the primary keeps failing. |

## loopctl architecture words

| Term | Meaning |
|---|---|
| **Engine** | The loop implementation: brain + hands. |
| **Brain / `LoopMachine`** | The pure state machine deciding each step — no IO, serializable. |
| **Driver / `BareLoop`** | The IO-doing half that executes the brain's steps. |
| **Sans-IO** | "Without input/output" — the design rule that keeps the brain pure data. |
| **`MachineStep`** | The brain's instruction: `CallLLM`, `CallTools`, `Compact`, or `Done`. |
| **`MachineState`** | What the brain awaits: model reply, tool results, compaction, or nothing (terminal). |
| **`MachinePolicy`** | The settings handed to the brain per step (max turns, window, thresholds). |
| **`history`** (the notebook) | Messages of past *successful* runs — durable across runs. |
| **`pending`** (the scratchpad) | The current run's messages — the coherent prefix is salvaged on cancel/failure (0.4.0); discarded whole only on the overflow family. |
| **`finalize()`** | The single exit door every run passes through (commit or discard, record, notify, re-arm). |
| **Soft error** | A failure reported *inside* the run as tool-result text — the model sees it and adapts; the run continues. |
| **Hard error** | A failure that ends the run as a `LoopError`. |
| **Circuit breaker** | A switch that stops calling something that keeps failing, and probes it occasionally to see if it recovered. |
| **Fallback chain** | The ordered list of backup models. |
| **Middleware** | A stackable layer around tool calls (timeout, caps, cache...). |
| **Pipeline** | The middleware chain plus the registry core at its center. |
| **Observer** | A read-only watcher of engine events. |
| **Hook** | A watcher with *veto power* — can block tool calls and compaction. |
| **Contributor** | A per-turn message injector (e.g. goal reminders) — never persisted. |
| **Memory** | A long-term store the agent reads from and writes to across turns. |
| **Reflector** | The analyzer of a failed tool call ("what went wrong, is it recoverable?"). |
| **Recovery strategy** | The decider after a failure (retry / skip / ask / fail). |
| **Correction** | A machine-usable fix from reflection: replaced input or swapped tool. |
| **Compactor** | The strategy for *how* to shrink a conversation. |
| **`ContextManager`** | Owns the compactor + sizing policy (window, threshold, target, token counter). |
| **Token counter** | The estimator turning messages into approximate token counts. |
| **Cancellation signal** | The shared flag that stops a run cooperatively at the next checkpoint. |
| **Cancel re-arm** | Re-setting the signal after a run so one cancel doesn't kill the agent forever. |
| **Audit trail** | `session.runs` — the append-only record of every run and turn, untouched by compaction. |
| **Trajectory record** | A whole-run snapshot captured by the built-in `TrajectoryObserver`: per-turn queries/responses, tool calls, durations, tokens, outcome. (Different thing from `MemoryCategory::Trajectory`, a memory entry about one tool call.) |
| **Memory extraction** | Mining reusable lessons (strategies, error recoveries, wasted calls) out of recorded runs and storing them as memories — the agent learning from experience. |
| **Consolidation** | A curation pass over a memory store: decay stale relevance, merge near-duplicates, prune what neither fresh nor useful. |
| **Half-life decay** | Exponential forgetting: relevance halves for each half-life of unaccessed age (default 14 days), weighted by category — facts fade slower than working memory. |
| **Quality score** | The composite that decides what a consolidation pass keeps: relevance + access history + recency + validated trust. |
| **Jaccard similarity** | Shared tokens over all tokens — the cheap text-overlap measure used to detect near-duplicate memories. |
| **Access stamp** | The record a *matched* retrieval leaves on a memory entry (`access_count`/`last_accessed`), folded in by the next consolidation — what makes retrieved memories resist decay. |
| **Provider-derived memory** | A memory authored by the LLM extraction pass, tagged `provider-derived` and excluded from injection by default — untrusted model output, not verified fact. |
| **File-backed store** | `FileMemoryStore` — memory persisted as one JSON line per entry, surviving process restarts (single-process; feature `file_memory`). |
| **loopctl-sqlite** | The companion crate: the same memory contract over a WAL-mode SQLite database — multi-process durability, durable access stamps. |
| **Loop detection** | Noticing the same tool operation (name + argument + result) repeating. |
| **Convergence detection** | Noticing the model's final answers becoming near-identical. |
| **Shield** | A risk scorer that can block dangerous tool input before it runs. |
| **Overhead tokens** | The reserved cost of system prompt + tool schemas in context estimates. |
| **No-progress guard** | The rule ending a run when compaction shaves nothing (instead of looping forever). |
| **Emergency line** | The always-on 95%-of-window compaction trigger. |
| **Preresolved result** | An answer the brain fills in itself (e.g. "tool not available") without dispatching. |
| **Attempt reset** | The stream handler's signal: "void everything buffered from the failed attempt." |
| **Think tool** | A built-in no-side-effect scratchpad (`ThinkTool`) the model reasons into before acting — its description teaches the procedure (restate goal → options → check → decide). |
| **Prompted structured output** | Getting structured JSON from providers without native support: the schema rides in the system prompt and a lenient scanner plus one corrective retry fish the answer out. |
| **Ratio token counter** | A `RatioTokenCounter` preset — token estimates from a per-provider chars-per-token ratio plus per-message overhead; the calibrated alternative to the default heuristic. |
| **Embedding** | Text as a vector of numbers, positioned so similar meanings sit close together — the basis of semantic retrieval. |
| **Vector index** | A nearest-neighbour store over embeddings: add vectors, get the top-k closest back (`VectorIndex`). |
| **Window probe** | The run-start question "how big is this model's context, really?" — answered from llama.cpp `/props` or Ollama `/api/show` when the server discloses it; the disclosure outranks the declared `context_window`. |
| **Calibration ratio** | The rolling correction (in basis points) between estimated and provider-reported input tokens — the figure keeps estimates honest on backends that report usage. |
| **Context figure** | The engine's current context-size number: *anchored* (built on a real reported `input_tokens` plus an estimated tail) or *estimated* (pure estimate). `RunEndContext.context_figure` says which drove the last trigger. |
| **Prune** | The no-LLM reclamation pass: old tool results beyond a protected tail are replaced by a `[cleared: prior tool output]` marker (originals handed to the demotion sink) — freeing context without a summarizer call. |
| **Overflow salvage** | Surviving a "prompt too long" rejection: the failed turn gets one compact-and-retry against a target strictly under the refused payload, instead of the run dying. |
| **Demotion sink** | Where compaction's evicted messages go instead of the void — typically a memory store, so evicted content stays recallable. |
| **Retention class** | The per-tool-result tag (`Durable`/`Requery`/default) that decides what pruning and compaction may clear, and in what order. |
| **Rolling compactor** | A compactor that re-processes only the messages since the last pass — compaction as a maintenance cadence, not one big rewrite. |
| **QA summarizer** | The three-step LLM compactor: summarize the about-to-drop slice, *question* what's missing, answer from the transcript before it's discarded. |
| **Structured summarizer** | The LLM compactor that emits sectioned summaries (facts / decisions / pending / questions) with contractually stable headings. |
| **Fallback compactor chain** | The never-fail compaction chain: quality-descending stages (QA → structured → truncate); the terminal `TruncatingCompactor` cannot fail, so the chain never fails to compact. |
| **Terminal capture** | The chain's guarantee-floor wrapper: the last-resort truncate always preserves at least `terminal_min_recent` recent messages. |
| **Landing target** | The post-compaction size the pass must actually reach — by default 15% of the trigger threshold, not the old 70%-of-threshold share. |
| **Gate decision** | One permission decision as serializable data: tool, args digest, verdict, rule id + source, reason, timestamp — one record per gated dispatch, joinable by `call_id`. |
| **Args digest** | A 16-hex fingerprint of a tool call's arguments over canonical (key-sorted) JSON — identifies the call without storing its content. |
| **Ask channel** | The external-approver mechanism: a hook's `ask` *parks* the run at the pre-execution boundary; an async answer (or timeout/cancel) resumes it. |
| **Grant** | A persisted approval rule ("allow `Read` on exactly these arguments") with a narrow scope ladder and a pinned tool-descriptor digest — re-asking is automatic when the tool changes. |
| **Budget gate** | The engine-side spend guard: soft lines warn once per dimension (`on_budget_warn`), the hard line refuses the *next* request (`BudgetExhausted`) — budgets are gates. |
| **Soft line / hard line** | The budget gate's two thresholds per dimension: crossing soft warns (once), crossing hard stops the next request before it is sent. |
| **Event hub** | `EventHub` — one `LoopObserver` fanning every engine event into a broadcast `LoopEvent` stream a CLI/TUI can subscribe to. |
| **Event ledger** | The per-event JSONL stream (`events.jsonl`, `TrajectoryEvent` records) — the ordered, replayable event spine. |
| **Determinism seams** | The injectable `Clock`/`IdGen`/`Rng` traits: swap in a fixed clock and seeded generators and the same run produces the same bytes. |
| **Manifest** | The `loop.yaml` document — a loop's declarative center: profiles deep-merge, `${VAR}` interpolates, validation reports spans, one `config_hash` identifies the resolved shape. |
| **Cassette** | A recorded real HTTP exchange (request/response + streamed events, scrubbed) replayed hermetically in tests — the wire is the oracle. |
| **Golden request bytes** | Committed canonical-JSON files pinning exactly what the engine builds per scenario — a red golden can only mean *our* construction drifted. |
| **ContentSource** | The read seam: `ReadTool` reads through any source a host defines (files, remote trees) — `FileSource` ships as the filesystem implementation. |
| **SearchSource** | The search seam: a `ContentSource` that can also walk entries, sniff binaries, and bound reads — one trait serves `Glob`/`Grep`/`CodeSearch`/`Tree`. |

## Design & pattern words

Terms from the [Principles](/principles/sans-io/) pages — the patterns and small algorithms the crate is built from.

| Term | Meaning |
|---|---|
| **State machine** | A system described by a fixed set of named situations (states) and allowed moves (transitions) — everything else is forbidden by construction. |
| **Transition** | One allowed move between states, caused by one event or input. |
| **Terminal state** | A state with no outgoing transitions — once entered, forever held (e.g. a finished run). |
| **Pure (function/core)** | Depends on nothing outside its inputs and changes nothing outside its outputs — same inputs, same answer, every time. |
| **Deterministic** | Same inputs always produce the same behavior — no randomness, clock, or network in the deciding path. |
| **Pure core / imperative shell** | The general sans-IO shape: decisions in pure data, all doing (IO) in a shell around it. |
| **Tokenization** | Splitting text into the fixed-vocabulary chunks (*tokens*) a model actually reads — why "4 characters ≈ 1 token" and why exact counts are model-specific. |
| **Heuristic** | A cheap rule of thumb that is wrong sometimes, on purpose, in a known direction (e.g. the token estimator errs high). |
| **Fingerprint (hash)** | A small number summarizing a larger value — equal values give equal fingerprints; comparing fingerprints stands in for comparing whole outputs. |
| **Sliding window** | Keeping only the last N things (a queue that drops the oldest) — "only the recent past counts." |
| **Jaccard similarity** | Size of two word-sets' overlap divided by their union — "what fraction of the words are shared" (0.0 to 1.0). |
| **Thundering herd** | Many clients reacting to the same failure in lockstep (e.g. retrying simultaneously), re-creating the overload — cured by jitter, probes. |
| **Idempotent** | Doing it twice has the same effect as once — the property that makes an operation safe to retry. |
| **Half-open (probe)** | A circuit breaker's experiment state: exactly one call is let through to test whether the target recovered. |
| **One-shot (signal)** | A signal that, once fired, stays fired — "reset" means swapping in a fresh one, never un-firing. |
| **Canonical (form)** | One agreed spelling for every equivalent input (`{"a":1,"b":2}` and `{"b":2,"a":1}` → the same bytes), so equivalence becomes equality. |
| **Epoch guard** | A counter that advances on each invalidation; work captures it before running and drops its result if it moved — closing the "invalidated while I was computing" race. |
| **Wave (dispatch)** | A group of tool calls proven safe to run at the same time; waves execute one after another, calls within a wave concurrently. |
| **Lane (stream)** | One interleaved content channel inside a single streamed reply — text, thinking, or one tool call — identified by its index; fragments route to slots by (kind, index). |
| **Determinism seam** | The general shape behind `Clock`/`IdGen`/`Rng`: every nondeterministic input enters through a trait you can replace, so "same run, same bytes" becomes testable. |
| **Park / resume** | Suspending a run at a safe boundary (nothing in flight, state coherent) and continuing it later from an external answer — the ask channel's lifecycle. |
| **Landing verification** | Checking the *result* of an operation against the target it promised (post-compaction size vs landing target), not trusting the operator's self-report. |

## Provider words

| Term | Meaning |
|---|---|
| **ApiClient** | loopctl's one trait for talking to any model provider. |
| **Profile builder** | The middle tier of provider setup (`ollama_builder()`, `azure_builder(resource)`, …): a client builder with a provider's endpoint/env-var/model facts pre-seeded, so config-driven hosts override instead of duplicate. |
| **`StreamRequest`** | The outbound bundle: messages + optional system prompt and tools. |
| **`RequestOptions`** | Per-request extras: model override, response format, tool constraint. |
| **Response format** | A forced JSON shape for the reply ("answer as this schema"). |
| **Tool constraint** | How strictly tool schemas are enforced: none / strict / grammar. |
| **Rate limit / 429** | The provider saying "too many requests — wait." `Retry-After` is its "wait this long" hint. |
| **Retry ladder** | The ordered retry logic (backoff growth, ceilings, escalation). |
| **Backoff** | Waiting longer between each retry (exponential by default). |
| **Jitter** | Random variation added to backoff so many clients don't retry in lockstep. |
| **Token bucket** | A rate-limiting container: requests take tokens; tokens refill at a set rate. |
| **Truncation (stream)** | A stream that died before its terminal event — reported honestly, retried. |
| **Thinking / reasoning** | The model's private scratch reasoning — streamed separately, never in the final message. |
| **SigV4** | AWS's request-signing scheme (used by Bedrock). |
| **Event-stream (AWS)** | Bedrock's binary framing for streamed replies (not SSE). |
| **Converse API** | Bedrock's cross-model request shape (the non-Anthropic path). |
| **Guided JSON** | vLLM's field for grammar-constrained output. |
| **Prompt-cache breakpoint** | A `cache_control` marker on the Anthropic wire asking the provider to cache the request prefix — loopctl marks the last tool definition, the system prompt, and the tail blocks. |
| **Cached input tokens** | The share of the input count the provider served from its prompt cache (`Usage::cached_input_tokens`) — the hit-rate number a cache actually pays for. |
| **Thinking effort** | The off/low/medium/high/max knob (`RequestOptions::effort`) telling a reasoning model how much thinking to spend. |
| **Session-scoped reasoning retention** | Prior turns' thinking blocks ride the conversation verbatim (until compaction ages them out) so the request prefix stays byte-stable and provider prompt caches keep hitting. |
| **Embedder** | A real `EmbeddingProvider` backend — `OllamaEmbedder` (local, `/api/embed`) or `OpenAiEmbedder` (`/v1/embeddings`). |

## Rust words used here

| Term | Meaning |
|---|---|
| **Trait** | An interface: a set of methods a type can promise to implement. |
| **`Arc`** | Atomic Reference Counted — a shareable owner of a value across threads. |
| **`Mutex`** | A lock ensuring one thread at a time touches data. |
| **Poisoned lock** | A lock left locked by a panicking thread — treated as an error (or recovered, by policy). |
| **`async` / `await`** | Rust's way to write concurrent code that waits without blocking a thread. |
| **`Future`** | A value representing work that will finish later. |
| **`Pin<Box<...>>`** | A heap-allocated, address-stable future — how object-safe async traits return their work. |
| **`serde`** | Rust's standard serialization library (to/from JSON here). |
| **Serde round-trip** | Serialize then deserialize — how a saved machine resumes exactly. |
| **`#[non_exhaustive]`** | "More variants may be added later" — your `match` needs a `_` arm. |
| **`catch_unwind`** | Catching a panic and turning it into a normal error — how tool panics are isolated. |
| **Derive macro** | Code generation triggered by `#[derive(...)]` — e.g. `#[derive(Tool)]`. |
| **Cargo feature** | A compile-time switch turning optional code on (`features = ["streaming"]`). |
| **`tokio::select!`** | Racing futures; "biased" means the branches are polled in written order (cancel first). |
| **`#[must_use]`** | A lint: ignoring this return value is probably a bug. |
| **Object safety** | A trait usable as `dyn Trait` (boxed, erased concrete type) — all loopctl's plugin traits are. |
