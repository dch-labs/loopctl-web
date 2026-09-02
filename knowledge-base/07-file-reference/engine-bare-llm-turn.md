# `src/engine/bare/llm_turn.rs` — one model call

Request construction and the two turn paths.

**Key items**

- `build_turn_request(transient)` — extras first, then `machine.full_history()`; system prompt; tool schemas (`None` when the registry is empty).
- `turn_request_options()` — your `request_options` + the fallback `routed_model()` override (which wins over your model field when routing is active).
- `do_turn` — the cancel guard, then `do_create_message` (biased select vs cancel + turn timeout) or `do_stream` (through the `StreamHandler`; `AttemptReset` wipes the accumulator; `Fallback` adopted wholesale).
- `routed_model()` / `routed_or_client_model()` — which model serves this turn.
- `record_turn_success` / `record_turn_failure` — the fallback-breaker glue (rate-limit escalations count as RateLimit; trips fire `on_fallback`; chain advance on failed fallbacks).

**Behavior notes**

- The user's input reaches the model only via the scratchpad — `turn_input` is for memory retrieval and observers, never the request.
- Overhead (system + schemas) is measured once with the configured counter; `response_format` turns suppress tools so their estimate over-reserves — conservative by design.
- Detection feeds only on terminal replies (no tool calls).

Deep dive: [The LLM turn](../02-engine/03-llm-turn.md).
