# Windows, averages, and similarity — cheap statistics for an agent's instincts

loopctl's safety systems make judgments that sound fancy: "this tool is getting unreliable," "the model is repeating itself," "these answers are converging." Under the hood, none of them use anything heavier than three textbook techniques — a **sliding window**, an **exponential average**, and **set similarity**. This page explains each one, with the actual formulas and worked numbers, so "EWMA of success" stops being a magic phrase.

The common philosophy first: these statistics were chosen because they are **cheap, local, and understandable**. They run on every call, hold a bounded amount of memory, and a human can recompute them by hand. Heavier machinery exists (embeddings, semantic models — see [memory](../04-extensions/03-memory.md) for where you'd plug those in), but for *is this behavior repeating?* the cheap tools are the right tools — and their weaknesses are known and fenced off rather than hidden.

---

## 1. The sliding window — only the recent past counts

**Idea:** keep the last N things; forget everything older. A loop (of tool calls, of answers) only matters if it's happening *now* — a repeated call from an hour ago is history, not a loop.

Mechanically it's a queue with a size limit: each new operation is pushed onto the end; when the queue is full, the oldest entry slides out the front. Memory cost is fixed at N, forever.

```text
window of 5, new call arrives:
[ A  A  B  C  A ]  →  drop oldest  →  [ A  B  C  A  A ]
                                                  ↑ pushed
```

This is the loop detector's memory ([loop detection](../03-safety/02-loop-detection.md)): the last **50** operations (100 when wired through the `DetectionManager`). Repetition is counted *within* the window — so a pattern must be both *repeated* and *recent* to trigger.

The window stores fingerprints, not raw results — which is its own little idea:

**Fingerprinting by hash.** Each recorded operation is the triple *(tool name, primary argument, hash of the result)*. The hash (a fast, non-cryptographic one) shrinks "what came back" — possibly kilobytes — into a single number that is equal if and only if the outputs were equal. So "same call, same result" stacks up as repetition, while "same call, *different* result" registers as **progress** — a search whose results keep changing is working, not looping, and must never be flagged. (Known limits, by design: the hash is stable only within a process — never persist it — and two different results colliding to the same hash is possible in principle, though astronomically unlikely to matter.)

### The record-and-check procedure, step by step

The detector's whole behavior is two procedures. **Recording** (after every dispatch):

```text
record(operation):
  1. progress flush — for every WARNED operation with the same (tool, primary_param)
     but a DIFFERENT result hash: drop it from the warned set, and remove its
     stale same-(tool,param) entries from the window
  2. if window.len() ≥ window_size: pop the oldest
  3. push the operation
  4. turn_count += 1 (saturating)
```

**Checking** (before dispatch, and on demand — a pure read):

```text
check():
  counts  = tally each distinct operation in the window
  flagged = those with count ≥ threshold_for_tool(tool)     // per-tool overrides
  keep    = only the MAXIMUM count among the flagged (ties included),
            sorted by (tool, primary_param)                 // deterministic order
  is_looping    = keep is non-empty
  should_stop   = stop_threshold > 0 AND max count ≥ stop_threshold
```

Two disciplines inside those lines carry real weight:

- **Asking never writes.** `check()` never marks anything as warned — only the stop path (and an explicit host `acknowledge_loop_warning`) does. So a monitoring poller can read the warning every second without consuming it; an unacknowledged below-threshold warning simply rebuilds on each poll until progress retires it or the stop line is crossed.
- **Recovery workflows are pre-forgiven.** A `ToolSignature` can mark an error as recoverable (`is_recoverable_error`) — and when such an error is recorded, the detector clears same-file edit warnings first. The legitimate rhythm *edit fails ("old text not found") → re-read → retry* looks identical to repetition from the window alone; this hook is the difference between a safety net and a false-alarm machine, and the docs call overriding it "critical."

And the exact shape of the warning the systems produce:

```text
"Loop detected: Operation 'Read(/etc/hosts)' repeated 3 times with same result.
 {suggestion}"                                    ← default: "Consider a different
                                                    approach or tool."
// + " STOPPING to prevent infinite loop."  appended at/over the stop threshold
```

---

## 2. The exponential average (EWMA) — old news fades

**Idea:** an average where each new observation counts fully and old observations fade geometrically. Called EWMA — **exponentially weighted moving average** — because the weights of past samples decay exponentially with distance.

loopctl's tool health scoring ([tool health](../03-safety/06-tool-health.md)) tracks success with a 70/30 blend:

```text
new_score = 0.7 × old_score  +  0.3 × sample        # sample = 1 for success, 0 for failure
```

Worked through, starting from a perfect 1.0:

```text
start           score = 1.000
call fails      score = 0.7×1.000 + 0.3×0 = 0.700
call fails      score = 0.7×0.700 + 0.3×0 = 0.490
call succeeds   score = 0.7×0.490 + 0.3×1 = 0.643
```

Notice the asymmetry that makes this the right shape for reliability scoring: **failures bite immediately (−30% of the whole range), recoveries heal slowly** (+0.3 per clean call). A tool must *earn* its way back — three straight failures cost 0.51 of score; it takes many successes to climb.

The "exponential" in the name, made concrete: after k newer samples, an old observation still carries weight 0.7ᵏ. After 10 calls it's 0.7¹⁰ ≈ 3%. So the score reflects *roughly the last handful of calls* — the window is soft and never needs trimming, unlike the hard window above.

**Why not the plain average?** The all-time success rate has the opposite failure mode: a tool that broke yesterday is 50% successful forever after, no matter how many thousand clean calls follow — ancient history vetoes the present. The EWMA forgets. loopctl's final `health_score` actually blends both — `0.3 × all-time rate + 0.7 × EWMA` — so a tool's long record still matters, but its *recent* behavior matters more. One number, two time horizons.

> An implementation detail worth knowing: there is no atomic float type in Rust's standard library, and health updates must be lock-free. So the score is stored as an integer scaled by 1,000,000 — "0.7" is literally stored as `700_000`, and the formula above runs in integer arithmetic inside an `AtomicU64`. Same math, no locks, no floats.

---

## 3. Set similarity (Jaccard) — how alike are two texts?

**Idea:** treat each text as a *set of words*; similarity is the fraction of words the two texts share:

```text
similarity(A, B) = |A ∩ B|  /  |A ∪ B|
                   shared words / all distinct words
```

This is the **Jaccard similarity** of the two word sets, and it powers [convergence detection](../03-safety/03-convergence.md) — noticing a model giving near-identical *final answers*, turn after turn.

Three worked examples (after normalization — lowercase everything, strip punctuation):

```text
A: "The deployment succeeded, and all tests passed!"
B: "the deployment succeeded and all tests passed"
→ identical word sets → 7/7 = 1.00      (punctuation/case: invisible)

A: "The deployment succeeded and all tests passed"
B: "Tests passed and the deployment succeeded"
→ same words, different order → 7/7 = 1.00   (word ORDER: invisible — a feature:
                                              rewording must not hide convergence)

A: "The build failed because tests failed"      {the, build, failed, because, tests}
B: "The build failed because lint failed"       {the, build, failed, because, lint}
→ shared {the, build, failed, because} = 4, union = 6 → 4/6 ≈ 0.67   (different content
                                              scores clearly below the 0.95 line)
```

Convergence fires when **3 consecutive** terminal answers each score ≥ **0.95** against their predecessor — each answer compared only to the one *before* it, so an A-B-A-B alternation never counts, and one genuinely different answer resets the streak.

### The streak, updated step by step

Jaccard produces the number; the streak policy decides what it means. Per terminal reply, in order:

```text
add_response(text):
  1. detection disabled?            → return nothing
  2. text empty?                    → streak = 0, clear the similar set
                                       (an acting turn's silence is a break)
  3. similarity vs EVERY window member computed — but only for the STATUS
     REPORT; the decision uses none of them except...
  4. ...the IMMEDIATELY PRECEDING reply (window.back()):
        similarity(new, prev) ≥ 0.95 ?  streak += 1, remember new in the set
                                     :  streak = 1, clear and re-seed the set
     (first reply ever: streak = 1)
  5. window maintenance — evict the oldest when full, push the new reply
  6. detected  ⇔  streak ≥ window_size (default 3)
```

Step 4's insistence on *predecessor-only* is a policy, not a convenience: comparing against the whole window would let `A B A B` alternate into a detection on the second `A` — which is not convergence, it's oscillation. Only *consecutive* near-identity counts, and the empty-text reset in step 2 keeps an acting turn (which often ends with brief text) from stitching two separate streaks together.

**The honesty clause.** Word-set similarity cannot see *meaning*: a paraphrase with fresh vocabulary scores low (missed), and shared boilerplate ("Sure! Here's what I found:") scores high (false alarm). That is precisely why the default action on convergence is `Warn` — log it, surface it, keep going — and the drastic actions (`Stop`, `AskUser`) are strictly opt-in. A heuristic with known blind spots is safe exactly when its blast radius is chosen to match.

---

## The three, side by side

| Technique | Question it answers | Used by | Memory cost |
|---|---|---|---|
| Sliding window + hashes | "has this *exact thing* repeated recently?" | loop detector | fixed (50–100 entries) |
| EWMA | "has this thing's *behavior* been drifting bad?" | tool health scores | one number per tool |
| Jaccard on word sets | "are these two *texts* near-identical?" | convergence detection | last few answers |

One shape underlies all three: **a small, bounded memory of the recent past, summarized into a number that crosses a line.** The lines (3 repeats, a 0.8 health score, 0.95 similarity, 3 consecutive) are all tunable constants — and every one of them trades false alarms against missed detections. When you tune them, you're choosing where the fence sits, not whether there is one.

---

## Related pages

- [Loop detection](../03-safety/02-loop-detection.md) · [convergence](../03-safety/03-convergence.md) · [tool health](../03-safety/06-tool-health.md) — the systems these statistics live in.
- [Memory](../04-extensions/03-memory.md) — the one place loopctl does heavier scoring, with its full formula.
- [Soft and hard errors](04-soft-and-hard-errors.md) — what happens *after* a statistic crosses its line.
