---
title: "`src/engine/bare/model_switch.rs` — `ModelSwitch`"
---


The atomic mid-session model change: a builder returned by `agent.switch_model(name)`, executed by `.apply()`.

**Key items**

- `switch_model(&mut self, model)` → `ModelSwitch` — holds `&mut BareLoop`, deliberately not `Clone`.
- `.with_context_window(tokens)` — set it when the new model's window differs.
- `.apply()` — validate name → poison preflight → `client.set_model` (false = abort, nothing changed) → optional window update → breaker reset + original-model update → `on_model_switched`.

**Behavior notes**

- All-or-nothing: a rejection at any step leaves the loop exactly as it was.
- Requires client support (`ApiClient::set_model`) — all shipped clients have it; the trait default rejects.
- Resets the fallback breaker because old-model failure counts are meaningless for the new model.
- Not gated by "configure before run" — mid-session use is the design (still: prefer between runs over during).

Deep dive: [Model switch](/engine/model-switch/).
