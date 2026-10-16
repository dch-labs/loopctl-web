---
title: "Sans-IO"
sidebar:
  order: 1
---

**Sans-IO** means "without input/output". It is a design pattern with one rule at its center:

**the part of your program that makes decisions should never touch the outside world.**

No network, no files, no clock, no randomness, and nothing whose answer could differ from one run to the next.

All of that lives in a separate shell that does the dirty work and reports back to your program.

loopctl's engine is built this way. If you read one page about how loopctl works, the [big idea](/start-here/the-big-idea/) page shows you the split.

This page explains the pattern itself: where it came from, what it buys you, what it costs, and how to spot it in your code.

## What counts as IO, and why it is separated

**IO (input/output)** is anything a program does to reach outside its own memory:

| Outside thing | Why it's trouble for a decision-maker |
|---|---|
| The network | Slow, flaky, different answers every time |
| Files, databases | Can change between two looks |
| The clock | "Now" is a different value every millisecond |
| Randomness | Two identical questions get different answers |

The common thread: **IO makes your behavior depend on things you do not control.** A decision-maker that touches IO becomes hard to test, because you must fake the world.

It becomes hard to save, since an open network connection does not serialize. And it becomes hard to reason about.

The reason: your same inputs no longer give the same answer.

The sans-IO answer is to quarantine your unpredictability. Your decision core becomes **plain data in, plain decision out**, and deterministic.

That means your same inputs always produce the same outputs.

The name comes from the Rust networking world, where protocol libraries (HTTP, QUIC) keep their connection logic as pure state machines.

Those libraries push the actual sockets to the edges. loopctl applies the same idea to your agent loop.

You may also see the general shape called a **pure core** with an **imperative shell**.

## The pattern, in the abstract

Every sans-IO design has the same three moving pieces:

```mermaid
flowchart LR
    W["the world<br/>(network, tools, clock)"] <--> S["SHELL<br/>does the IO"]
    S -- "results as plain data" --> C["CORE<br/>pure decisions"]
    C -- "instructions as plain data" --> S
```

1. **The core** holds all your state and all your rules. You ask it "what next?" and it answers with an instruction: data, not action.

2. **The shell** executes your instruction in the real world.

3. **The shell reports back**, feeding the outcome into your core as plain data. Repeat until your core says "done."

Your core never calls anything. It only ever asks to be told. That single inversion is the whole pattern.

## How loopctl applies it

| Pattern piece | loopctl name | Where it lives |
|---|---|---|
| The core | `LoopMachine` (the brain) | `src/engine/core/machine.rs` |
| The shell | `BareLoop` (the driver / the hands) | `src/engine/bare.rs` + submodules |
| The instructions | `MachineStep`: `CallLLM` · `CallTools` · `Compact` · `Done` | the brain's only vocabulary |
| The reports | The feeds: `model_response()` · `tool_results()` · `compaction_result()` · ... | the only way results enter the brain |

Your discipline is enforced by details, not comments:

- **Settings are never stored in your brain.** The driver hands your brain a fresh `MachinePolicy` of max turns, context window and thresholds on every step.

- This is what keeps your brain serializable: saved state is pure data, with no config to drift out of sync.

- **Your brain holds no clock, no connection, no handle to anything.** Turn counts and token estimates are numbers your driver feeds it, not things it observes.

- **Asking never changes anything.** `next_step()` is pure: call it twice in a row and you get the same answer.

- All change in your engine happens through feeds.

## The vocabulary, in actual types

The brain's entire outward vocabulary is four instructions, and its inward vocabulary is the matching feedback methods. In real types, with signatures shortened:

```rust
enum MachineStep {
    CallLLM   { turn: usize },
    CallTools { turn: usize, calls: Vec<ToolCall> },
    Compact   { reason: CompactReason },     // Emergency | ThresholdExceeded | Manual
    Done(MachineOutcome),                    // Completed | Cancelled | MaxTurnsExceeded | Failed
}

impl LoopMachine {
    // the one question
    fn next_step(&mut self, policy: MachinePolicy) -> MachineStep;

    // the feeds — the ONLY way results enter the brain
    fn accept_input(&mut self, input: &str);
    fn model_response(&mut self, response: Message, context_tokens: u64);
    fn tool_results(&mut self, messages: Vec<Message>);
    fn compaction_result(&mut self, compacted: Vec<Message>, before: u64, after: u64);
    fn compaction_noop(&mut self, before: u64, after: u64);
    fn set_context_tokens(&mut self, n: u64);
    fn inject(&mut self, message: Message);
    fn cancel(&mut self);
    fn fail(&mut self, error: LoopError);

    // the two maintenance calls, used only by the exit door
    fn commit_pending(&mut self);    // success exit: scratchpad → notebook
    fn salvage_pending(&mut self);   // cancel/failure exit: coherent prefix → notebook
    fn discard_pending(&mut self);   // overflow exit: scratchpad → trash (whole)
}
```

Count them: **one question, four instructions, eleven ways in.** That is the complete interface between the two halves of your engine.

Anything else either half knows, it knows about itself.

That is exactly why your seam is auditable: the entire set of ways the world can touch your run fits on one screen.

## One loop iteration, method by method

```mermaid
sequenceDiagram
    participant D as driver (BareLoop)
    participant M as brain (LoopMachine)
    participant C as client (ApiClient)
    D->>M: accept_input("summarize this folder")
    loop until Done
        D->>M: next_step(policy)   — policy rebuilt EVERY iteration
        M-->>D: CallLLM { turn: 3 }
        D->>C: stream_messages_with_options(request, options)
        C-->>D: events, folded into one Message
        D->>M: model_response(message, 4_812)
        Note over M: no tool calls → Terminal(Completed) —<br/>else: classify calls against advertised names,<br/>state = AwaitingTools
        D->>M: next_step(policy)
        M-->>D: CallTools { turn: 3, calls }
        D->>D: dispatch — waves, pipeline, recovery
        D->>M: tool_results(vec![one user message of result parts])
        Note over M: state = Start — consumes pending_tools
    end
    D->>M: next_step(policy)
    M-->>D: Done(Completed { final_text })
    D->>D: finalize(None) → commit_pending()
```

Details a first reading misses:

- **The turn number belongs to your brain.** It names the turn in `CallLLM { turn }`. Your driver never counts turns itself but borrows your brain's count.

- So you get exactly one turn ledger rather than two that can drift. **`tool_results` takes one user message containing all result parts.**

- Your provider convention, that results ride a user-role message, is assembled by your driver and accepted whole by your brain.

- One batch, one feed, one state change. **`model_response` does classification.**

- Your brain itself sorts each requested call against the tool names your driver advertised. A known name becomes a pending call awaiting dispatch.

- An unknown name is pre-answered with an `is_error` result, "tool 'x' is not available", which travels back to your model without ever touching the registry.

- Even your error-recovery is a brain decision, made from data. **Your policy is rebuilt every iteration** from session config, run config, and current extras.

- So a mid-run config change of yours takes effect on the very next step. That is why nothing setting-shaped is ever serialized.

## What serializes, exactly

"Save the run" is `serde_json::to_string(&machine)`. Here is what is inside the bytes, and what deliberately is not:

| Serializes (the brain) | Stays behind (the shell) |
|---|---|
| `state` — including `Failed` *with its error record* | the client, the registry, every observer/hook/middleware |
| `history` + `pending` — both message buffers | the cancel signal (a fresh one is wired on restore) |
| `turns_taken`, `context_tokens`, `cancelled` | the policy — settings are re-supplied per step |
| `pending_tools` — including pre-answered unknown-tool results | nothing else: the brain has nothing else |

Two refinements that your tests pin. `fail()` stores the error inside `Terminal(Failed)` before anything could be serialized.

So a saved errored machine of yours restores as an errored machine, never as a mysterious mid-state.

And your restored machine makes identical `next_step` decisions, so your resume is exact by construction.

The reason: your state is your behavior.

## What the pattern buys you

### 1. Testing without theater

To test "does the engine compact at 95% of the window?", you build a machine, feed it a fake token count, and read its step.

No mock HTTP server, no sleeping, no flakiness. Your engine's behavior tests run in microseconds because your brain has nothing slow inside it.

### 2. Pause anywhere, resume anywhere

Your plain data can be serialized, turned into bytes with `serde` and stored.

Because your brain is nothing but plain data, your run can be saved mid-flight on one machine and restored on another.

The resumed brain makes identical decisions, which a test pins. You cannot serialize an open network connection.

That is exactly why the connection lives in your shell.

### 3. The engine outlives any provider

The brain does not know what an OpenAI or an Anthropic is. All model access flows through one small trait, `ApiClient`, in the shell. New providers plug in without the decision logic ever noticing.

### 4. Determinism makes bugs reproducible

When a run misbehaves, the sequence of (state, feed) pairs is a complete, replayable explanation. Nothing hidden happened between two lines of your log, and nothing could happen, because the brain cannot act on its own.

## What the pattern costs

Honest accounting: this split is not free.

- **Every outcome needs a matching feed.** Your brain cannot "find out" on its own, so your shell must faithfully report model replies, tool results, compaction outcomes and cancel requests.

- A forgotten feed path is a real bug class for you. This is why your driver routes all exits through one `finalize()` door.

- It is why you have exactly two compaction feeds, one for "history was rewritten" and one for "nothing changed", where a lazier design would use one.

- **More explicit plumbing.** An ordinary loop of yours can inline "call the model, use the reply".

- A sans-IO loop must phrase that as a step, a state, and a feed. The machinery in [the state machine](/engine/state-machine/) and [the driver loop](/engine/driver-loop/) pages is that plumbing.

- **Your split must be honest.** One sneaky clock read or network call inside your brain and your guarantees of serializable, deterministic and testable silently break.

- The boundary is a discipline for you, not a wall the compiler enforces here.

## How to spot the seams in the code

When you read loopctl's source, ask of any line: does this decide, or does this do?

| If it decides... | If it does... |
|---|---|
| it belongs in `LoopMachine` (or a pure helper) | it belongs in the driver or a provider client |
| its inputs are policy + feeds | its inputs are connections, registries, the filesystem |
| it can run in a plain `#[test]` with no mocks | it needs `#[tokio::test]`, a client, or a temp dir |

The same question applies to your subsystems. Your loop detector is pure, a window of recorded operations with no IO.

Your reflector runs a model call, so it lives behind a trait in your shell with a no-op default.

Whenever loopctl needs both deciding and doing for one of your features, the decision half is pure and the doing half is a pluggable trait object.

## Related pages

- [The big idea](/start-here/the-big-idea/): the same split, as your introduction.

- [State machines](/principles/state-machines/): the shape your pure core takes.

- [The state machine](/engine/state-machine/) and [the driver loop](/engine/driver-loop/): your two halves in full detail.
