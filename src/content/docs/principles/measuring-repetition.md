---
title: "Windows, averages, and similarity"
sidebar:
  order: 7
---

Your agent's safety systems make judgments that sound fancy: "this tool is getting unreliable," "the model is repeating itself," "these answers are converging."

None of them use anything heavier than three textbook techniques: a **sliding window**, an **exponential average**, and **set similarity**.

This page explains each one, with the actual formulas and worked numbers, so "EWMA of success" stops being a magic phrase for you.

The common philosophy first: these statistics were chosen because they are cheap, local, and understandable. They run on every call of yours, hold a bounded amount of memory, and you can recompute them by hand.

Heavier machinery exists, such as embeddings and semantic models. See [memory](/extensions/memory/) for where you would plug those in.

For your question, whether a behavior is repeating, the cheap tools are the right tools. Their weaknesses are known and fenced off rather than hidden.

## 1. The sliding window

**Idea:** you keep the last N things and forget everything older. A loop of tool calls or answers only matters if it is happening now.

A repeated call from an hour ago is history, not a loop. Mechanically it is a queue with a size limit, and each new operation is pushed onto the end.

When your queue is full, the oldest entry slides out the front. Memory cost is fixed at N, forever.

```text
window of 5, new call arrives:
[ A  A  B  C  A ]  →  drop oldest  →  [ A  B  C  A  A ]
                                                  ↑ pushed
```

This is your loop detector's memory ([loop detection](/safety/loop-detection/)): the last 50 operations, or 100 when you wire it through the `DetectionManager`.

Repetition is counted within the window, so a pattern must be both repeated and recent to trigger you.

Your window stores fingerprints, not raw results, which is its own little idea:

**Fingerprinting by hash.** Each operation your detector records is the triple of tool name, primary argument, and hash of the result.

The hash, a fast non-cryptographic one, shrinks what came back, possibly kilobytes, into a single number. That number is equal if and only if the outputs were equal.

So "same call, same result" stacks up for you as repetition, while "same call, different result" registers as progress.

A search of yours whose results keep changing is working rather than looping, and must never be flagged.

Known limits are by design. The hash is stable only within a process, so never persist it. Two different results colliding to the same hash is possible in principle, though unlikely to matter to you.

### The record-and-check procedure

Your detector's whole behavior is two procedures. **Recording** happens after every dispatch:

```text
record(operation):
  1. progress flush — for every WARNED operation with the same (tool, primary_param)
     but a DIFFERENT result hash: drop it from the warned set, and remove its
     stale same-(tool,param) entries from the window
  2. if window.len() ≥ window_size: pop the oldest
  3. push the operation
  4. turn_count += 1 (saturating)
```

**Checking** happens before dispatch and on demand, and it is a pure read:

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

- **Asking never writes.** Your `check()` never marks anything as warned. Only the stop path, or an explicit `acknowledge_loop_warning` from you, does.

- So a monitoring poller of yours can read the warning every second without consuming it. An unacknowledged below-threshold warning rebuilds on each poll until progress retires it or the stop line is crossed.

- **Recovery workflows are pre-forgiven.** Your `ToolSignature` can mark an error as recoverable with `is_recoverable_error`.

- When your detector records such an error, it clears same-file edit warnings first. The legitimate rhythm of an edit failing with "old text not found", then re-reading, then retrying looks identical to repetition from the window alone.

- This hook is the difference for you between a safety net and a false-alarm machine, and the docs call overriding it critical.

Here is the exact shape of the warning your systems produce:

```text
"Loop detected: Operation 'Read(/etc/hosts)' repeated 3 times with same result.
 {suggestion}"                                    ← default: "Consider a different
                                                    approach or tool."
// + " STOPPING to prevent infinite loop."  appended at/over the stop threshold
```

## 2. The exponential average (EWMA)

**Idea:** an average where each new observation counts fully and old observations fade geometrically. It is called EWMA, **exponentially weighted moving average**, because your weights of past samples decay exponentially with distance.

Your tool health scoring ([tool health](/safety/tool-health/)) tracks success with a 70/30 blend:

```text
new_score = 0.7 × old_score  +  0.3 × sample        # sample = 1 for success, 0 for failure
```

Work it through yourself, starting from a perfect 1.0:

```text
start           score = 1.000
call fails      score = 0.7×1.000 + 0.3×0 = 0.700
call fails      score = 0.7×0.700 + 0.3×0 = 0.490
call succeeds   score = 0.7×0.490 + 0.3×1 = 0.643
```

Notice the asymmetry that makes this the right shape for your reliability scoring: **failures bite immediately at 30% of the whole range, recoveries heal slowly at 0.3 per clean call**.

A tool must earn its way back with you. Three straight failures cost 0.51 of score, and it takes many successes to climb.

The "exponential" in the name, made concrete: after k newer samples, an old observation of yours still carries weight 0.7ᵏ. After 10 calls that is 0.7¹⁰, roughly 3%.

So your score reflects roughly the last handful of calls. The window is soft and never needs trimming, unlike the hard window above.

**Why not the plain average?** The all-time success rate has the opposite failure mode. A tool that broke yesterday is 50% successful forever after, no matter how many thousand clean calls follow.

Ancient history vetoes the present. The EWMA forgets, which is what you want.

Your final `health_score` blends both, `0.3 × all-time rate + 0.7 × EWMA`, so a tool's long record still matters but its recent behavior matters more. One number, two time horizons.

One implementation detail is worth knowing. There is no atomic float type in Rust's standard library, and health updates of yours must be lock-free.

So the score is stored as an integer scaled by 1,000,000. "0.7" is literally stored as `700_000`, and the formula above runs in integer arithmetic inside an `AtomicU64`.

Same math, no locks, no floats.

## 3. Set similarity (Jaccard)

**Idea:** treat each text as a set of words. Similarity is the fraction of words the two texts share:

```text
similarity(A, B) = |A ∩ B|  /  |A ∪ B|
                   shared words / all distinct words
```

This is the **Jaccard similarity** of your two word sets, and it powers [convergence detection](/safety/convergence/): noticing your model giving near-identical final answers turn after turn.

Three worked examples for you, after normalization by lowercasing everything and stripping punctuation:

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

Convergence fires when 3 consecutive terminal answers of yours each score at or above 0.95 against their predecessor.

Each answer is compared only to the one before it, so an A-B-A-B alternation never counts. One genuinely different answer resets your streak.

### The streak, updated step by step

Jaccard produces your number. The streak policy decides what it means for you. Per terminal reply, in order:

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

Step 4 insists on predecessor-only, which is a policy rather than a convenience. Comparing against your whole window would let `A B A B` alternate into a detection on the second `A`.

That is not convergence but oscillation. Only consecutive near-identity counts.

The empty-text reset in step 2 keeps an acting turn, which often ends with brief text, from stitching two of your streaks together.

**The honesty clause.** Word-set similarity cannot see meaning. A paraphrase with fresh vocabulary scores low, which is a miss, and shared boilerplate scores high, which is a false alarm.

That is precisely why your default action on convergence is `Warn`: log it, surface it, keep going. The drastic actions, `Stop` and `AskUser`, are strictly opt-in for you.

A heuristic with known blind spots is safe exactly when you choose its blast radius to match.

## The three, side by side

| Technique | Question it answers | Used by | Memory cost |
|---|---|---|---|
| Sliding window + hashes | "has this *exact thing* repeated recently?" | loop detector | fixed (50–100 entries) |
| EWMA | "has this thing's *behavior* been drifting bad?" | tool health scores | one number per tool |
| Jaccard on word sets | "are these two *texts* near-identical?" | convergence detection | last few answers |

One shape underlies all three: a small, bounded memory of the recent past, summarized into a number that crosses a line.

The lines, 3 repeats, a 0.8 health score, 0.95 similarity, 3 consecutive, are all tunable constants by you.

Every one of them trades false alarms against missed detections. When you tune them, you choose where the fence sits, not whether there is one.

## Related pages

- [Loop detection](/safety/loop-detection/), [convergence](/safety/convergence/), [tool health](/safety/tool-health/): the systems your statistics live in.

- [Memory](/extensions/memory/): the one place loopctl does heavier scoring, with its full formula.

- [Soft and hard errors](/principles/soft-and-hard-errors/): what happens after your statistic crosses its line.
