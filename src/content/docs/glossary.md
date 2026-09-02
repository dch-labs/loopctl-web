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
| **`pending`** (the scratchpad) | The current run's messages — discarded if the run fails. |
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
| **Loop detection** | Noticing the same tool operation (name + argument + result) repeating. |
| **Convergence detection** | Noticing the model's final answers becoming near-identical. |
| **Shield** | A risk scorer that can block dangerous tool input before it runs. |
| **Overhead tokens** | The reserved cost of system prompt + tool schemas in context estimates. |
| **No-progress guard** | The rule ending a run when compaction shaves nothing (instead of looping forever). |
| **Emergency line** | The always-on 95%-of-window compaction trigger. |
| **Preresolved result** | An answer the brain fills in itself (e.g. "tool not available") without dispatching. |
| **Attempt reset** | The stream handler's signal: "void everything buffered from the failed attempt." |

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

## Provider words

| Term | Meaning |
|---|---|
| **ApiClient** | loopctl's one trait for talking to any model provider. |
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
