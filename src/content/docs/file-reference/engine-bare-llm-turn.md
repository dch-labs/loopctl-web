---
title: "src/engine/bare/llm_turn.rs"
---

This file builds your request and runs the two turn paths. Read it when you want to know exactly what leaves the process on a turn.

## Key items

`build_turn_request(transient)` puts extras first, then `machine.full_history()`, then your system prompt, then tool schemas, which are `None` when the registry is empty.

`turn_request_options()` combines your `request_options` with the fallback `routed_model()` override, which wins over your model field when routing is active.

`do_turn` runs the cancel guard, then either `do_create_message`, a biased select against cancel plus turn timeout, or `do_stream` through the `StreamHandler`.

In streaming, `AttemptReset` wipes the accumulator, and a `Fallback` is adopted wholesale.

`routed_model()` and `routed_or_client_model()` tell you which model serves this turn.

`record_turn_success` and `record_turn_failure` are your fallback-breaker glue. Rate-limit escalations count as RateLimit, trips fire `on_fallback`, and the chain advances on failed fallbacks.

## Behavior notes

Your user's input reaches the model only via the scratchpad. `turn_input` exists for memory retrieval and observers, never for the request.

Overhead, meaning system plus schemas, is measured once with your configured counter. Since 0.4.0 a `response_format` turn no longer reserves the tool schemas its request suppresses.

Reported usage feeds your calibration ratio and anchor, as covered in [context accounting](/engine/context-accounting/).

Detection feeds only on terminal replies, so turns with tool calls never count.

Deep dive: [The LLM turn](/engine/llm-turn/).
