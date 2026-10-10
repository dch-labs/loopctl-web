# Context accounting — how the engine decides the window is full

Compaction (the [previous page](06-compaction.md)) is the *act* of shrinking. This page is the *decision layer* under it: what number the engine compares against the window, where that number comes from, and the three 0.4.0 mechanisms that moved the decision from guesses toward real numbers — the **window probe**, **usage calibration/anchoring**, the **prune** pass, and **overflow salvage**. Sources: `src/engine/bare.rs`, `src/engine/bare/prune.rs`, `src/compact.rs`, `src/provider/openai.rs`.

**Read this if:** your provider's real context is smaller than the declared window, your compaction triggers at the "wrong" time, or a `ContextExceeded` arrived with a payload you believed fit.

---

## The words, once

| Term | Plain meaning |
|---|---|
| **Declared window** | `SessionConfig::context_window` — your guess, default 200,000. |
| **Disclosed window** | What the provider's metadata endpoint *says* it accepts (llama.cpp `/props`, Ollama `/api/show`). `None` when the provider discloses nothing. |
| **Resolved window** | The one number a run actually uses: **probe over declaration** — unless you declared `0` (the deliberate opt-out, which wins). |
| **Context figure** | The engine's current size number. Either **estimated** (pure counter) or **anchored** (a real reported `input_tokens` plus an estimated tail). |
| **Calibration ratio** | A rolling correction (basis points, clamped `[250, 4000]`) between estimates and reported usage — applied whenever no fresh anchor exists. |
| **Prune** | The no-LLM reclamation pass: old tool results beyond a protected tail become `[cleared: prior tool output]` markers. Opt-in. |
| **Overflow salvage** | The one compact-and-retry a provider's oversized-prompt rejection earns, under a target strictly below the refused payload. |

---

## The window probe — ask, don't guess

The declared window is a guess the engine used to trust blindly. Since 0.4.0, at each **run start** the driver asks the client's `model_context_window()`:

- **llama.cpp `/props`** — `default_generation_settings.n_ctx`, **divided by `total_slots`**: a `--parallel` server splits its KV budget across slots, and the per-slot allocation is what any single request must fit (the incident that built this: a ~140k-token run 500'd "Context size has been exceeded" against a proxy whose real per-slot window — 65,536 — was machine-readable all along).
- **Ollama `/api/show`** — a POST carrying the model name; the `context_length` key matched by suffix (real Ollama keys it by architecture — `llama.context_length`).
- **Hosted APIs** (OpenAI, Anthropic, Gemini) disclose nothing — the default `None`, and the declaration stands.

Probes are **fail-soft** (`None` on timeout, HTTP error, or garbage — never a turn error), bounded by their own 5-second deadline (a wedged metadata endpoint costs seconds, not the 120-second conversational read timeout), read through the crate's bounded-body control, and cached per model epoch — `set_model` clears the cache, so a hot-swapped model re-probes.

The resolution rules:

1. Probe over declaration — the disclosure is what the server will actually accept; the declaration is a guess.
2. A declared `0` stays `0` — a deliberate opt-out outranks any disclosure.
3. The resolved number is **frozen for the run's whole life** — the trigger and the emergency line cannot disagree mid-run. A model switch invalidates it; the next run re-resolves.
4. A probing resolution **re-syncs** the installed `ContextManager` (machine trigger and compactor target unify on the disclosed number); a probe-less resolution leaves a host-installed manager exactly as built — and reverts a manager an earlier probe had synced (otherwise a `switch_model` without a window would leave the manager targeting a stale disclosed number while the machine triggered on the declaration).

`TurnEndContext.context_window` reports the denominator on every turn end (`None` exactly under the disabled policy), so a utilization display divides by the limit the engine actually enforced. Telemetry: `loopctl.context.window` (gauge, `source=probe|declared`) on every change, `loopctl.context.probe.failures` (`kind=timeout|http|parse`) per failed attempt.

---

## The figure — estimate, calibration, anchor

The raw figure is the token counter's estimate of what the wire will carry: conversation + system prompt + tool schemas + this turn's transients. Three corrections sit on top:

### 1. Suppression-aware overhead

A turn running under a `response_format` doesn't reserve the tool schemas its request suppresses (OpenAI/Gemini drop `tools` outright; Anthropic substitutes one synthesized forced tool, uncounted — a bounded, small under-reserve). Compaction's reservation keeps the full sum for the post-compaction turn.

### 2. The calibration ratio

When the provider reports real `input_tokens`, the prediction error feeds a rolling integer-thousandths ratio — the first report seeds it, later reports halve the distance, clamped to `[250, 4000]` so an absurd report cannot peg it. The ratio applies at every estimate update, keeping the machine's stored figure in one scale. A zero-bearing report is no usage at all: a backend reporting `input_tokens: 0` throughout never moves it (identity, byte-identical behavior). The ratio surfaces per update as a `loopctl.estimate.calibration` metric event and at run end through `RunEndContext.calibration_ratio_bp` (`None` = no ground truth ever arrived — the honest reading). When the ratio moves, the installed manager's window re-syncs in converted units — the compactor's target and the machine's trigger line stay in one scale.

### 3. The anchor

When the provider reports usable `input_tokens`, the figure becomes **`reported_input + calibrated(estimate of the appends since that report)`** — the real number carries the figure; the error surface shrinks from the whole history to the tail. The anchor:

- arms only on non-zero reports (an all-zero backend never anchors — dch's local shape),
- invalidates wherever the wire changes wholesale (a compaction pass, any model change — a different tokenizer breaks the pairing),
- ages on the session-wide turn basis (an anchor surviving into later runs reads as aging, not fresh).

With no anchor, the figure is exactly the calibrated estimate — usage-less backends are byte-identical to before. `RunEndContext.context_figure` says which figure drove the last trigger (`source: Anchored | Estimated`, plus the anchor's age in completed turns).

---

## Prune — reclamation without a summarizer

Compaction rewrites the conversation with an LLM (or drops its middle). Prune is cheaper: it clears **old tool results** whose content the model can re-derive, without touching anything else.

```rust
agent.set_prune(PruneConfig::default())?;   // opt-in; off by default
```

The pass runs at the pre-request site, before the compaction deferral:

1. Everything **beyond a protected tail** (default 2,000 tokens) is eligible.
2. **Untagged results clear first**; `Requery`-tagged results clear only when the untagged pool can't satisfy a minimum-free gate (a fraction of the window, default 10%, evaluated in the counter's raw units so a settled calibration ratio can't distort the verdict); `Durable` never clears. (The classes: [retention classes](../01-core-data/01-messages.md#retention-classes--what-compaction-may-clear).)
3. Cleared content becomes the `[cleared: prior tool output]` marker — identity intact (call id, tool name, error flag, retention class), oldest first, deterministic.
4. The originals go to the demotion sink under `CompactReason::Prune` — pruned is not destroyed.

The prune line must sit strictly below the compaction threshold — validated with `InvalidInput`, never clamped. **A prune that frees enough can avert the compaction it would otherwise defer to.**

---

## Overflow salvage — surviving the provider's "no"

A provider rejection whose text reports an oversized prompt used to end the run. Now it earns the turn's **one** compact-and-retry:

```text
provider rejects: "prompt too long" (is_context_overflow)
  → the failed turn fires its turn-end event
  → the machine is forced onto the emergency compaction path
    with target = min(configured target, half the refused estimate)
    (CompactSizing::target_override — the landing must sit strictly
     UNDER the payload the provider refused, because the configured
     target can sit above what a provider whose real limit is below
     the declared window accepts)
  → the same turn is re-requested against the compacted history
  → a repeat rejection on the spent turn is a genuine misfit:
    Err(ContextExceeded), run-end carries unfinished_input
```

The budget is **per run** (turn numbers restart; the spent retry clears at run start — a follow-up run's salvage is never denied by the prior run's). If the conversation has nothing to shrink, the figure resets and the turn re-enters directly.

---

## How the pieces order, per model call

```mermaid
flowchart TD
    R["run start"] --> P["resolve window:<br/>probe over declaration<br/>(0 wins; frozen for the run)"]
    P --> L["loop: next_step"]
    L --> B{"budget gate installed?<br/>(see safety)"]
    B -- "hard crossing" --> BX["Err(BudgetExhausted) —<br/>refused before the wire"]
    B -- pass --> PR{"prune armed and<br/>over the prune line?"}
    PR -- yes --> PRX["prune pass — clear old tool<br/>results to markers; sink originals"]
    PRX --> FW{"still over the<br/>compaction line?"}
    PR -- no --> FW
    FW -- "no" --> SEND["send the request"]
    FW -- "threshold" --> CMP["Compact(ThresholdExceeded)"]
    FW -- "emergency" --> CMP2["Compact(Emergency)"]
    CMP --> SEND
    CMP2 --> SEND
    SEND --> REJ{"provider says<br/>prompt too long?"}
    REJ -- "first time" --> SAL["overflow salvage:<br/>compact under the refused payload,<br/>re-request the same turn"]
    SAL --> SEND
    REJ -- "budget spent" --> CX["Err(ContextExceeded)"]
    REJ -- no --> OK["figure update:<br/>calibrate on reported usage;<br/>arm the anchor"]
```

---

## Configuration quick reference

```rust
agent.set_prune(PruneConfig::default())?;          // opt-in reclamation
// (PruneConfig: protected tail budget 2_000, minimum-free fraction 10%,
//  prune line validated strictly below the compaction threshold)

// The window: declare what you know; the probe corrects what the server knows.
SessionConfig::default().with_context_window(0)    // the deliberate opt-out —
                                                    // no window policy at all
```

Read-only visibility: `agent.context_tokens()`, `machine.context_tokens()`, `TurnEndContext.context_tokens` / `.context_window`, `RunEndContext.calibration_ratio_bp` / `.context_figure`.

---

## Related pages

- [Compaction](06-compaction.md) — the pass itself: triggers, compactors, demotion.
- [Session config](../01-core-data/06-session-config.md) — the declared window and its `0` sentinel.
- [Messages](../01-core-data/01-messages.md) — retention classes, what prune may clear.
- [Tokens and context windows](../09-principles/03-tokens-and-context.md) — why estimates exist at all.
- [File reference: engine/bare/prune.rs](../07-file-reference/engine-bare-prune.md)
