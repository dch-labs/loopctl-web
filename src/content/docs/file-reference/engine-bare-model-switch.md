---
title: "src/engine/bare/model_switch.rs"
---

This file gives you the atomic mid-session model change: a `ModelSwitch` builder returned by `agent.switch_model(name)` and executed by `.apply()`.

## Key items

`switch_model(&mut self, model)` hands you a `ModelSwitch` that holds `&mut BareLoop` and is deliberately not `Clone`.

Call `.with_context_window(tokens)` when your new model's window differs from the old one.

`.apply()` runs the sequence: validate name, poison preflight, `client.set_model`, optional window update, breaker reset plus original-model update, then `on_model_switched`. A false from `set_model` aborts with nothing changed.

## Behavior notes

The switch is all-or-nothing. A rejection at any step leaves your loop exactly as it was.

It requires client support through `ApiClient::set_model`. All shipped clients have it, and the trait default rejects.

Your fallback breaker resets, because old-model failure counts are meaningless for the model you just chose.

Nothing gates this behind "configure before run", since mid-session use is the design. Prefer switching between runs over during one when you can.

Deep dive: [Model switch](/engine/model-switch/).
