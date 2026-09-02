# Gotchas — the traps, collected

Every sharp edge in loopctl in one place. Each entry says what happens, why, and what to do. Organized by area; the worst ones first.

---

## Engine & runs

**1. Default settings give tools ZERO retries.**
The stock reflector (`NoopReflector`) marks every failure non-recoverable, so each tool call gets exactly one attempt. Install a reflector ([reflection](../03-safety/05-reflection.md)) if you want retry behavior.

**2. Setters must run before the first `run()`.**
`set_memory`, `set_pipeline`, `register_observer`, ... — call them on a freshly built agent. Debug builds panic ("debug_assert_idle"); release builds misbehave quietly.

**3. A failed run leaves history clean — but a run that compacted mid-run does not.**
Compaction is a commit point: it folds the scratchpad into history. If that run later fails, the compacted history stays. That's by design; just don't expect "failed run = nothing changed" after mid-run compaction.

**4. `max_turns` counts model turns, not tool calls.**
One turn can contain many tool calls (a whole parallel wave is one turn). Default is 200 turns — that's a lot of work.

**5. The user input reaches the model only through the machine's scratchpad.**
Don't "simplify" by passing input through custom plumbing — you'll send it twice or not at all. The input rides `accept_input` → `pending` → every request via `full_history()`.

**6. Two token counters = flapping compaction.**
Trigger decisions and post-compaction measurements must share one counter (install it on the `ContextManager`; the driver follows it automatically). Mixing a heuristic with real tokenizer counts makes compaction chase its tail.

**7. `session.runs` is the recovery source after compaction.**
After the conversation is summarized, the original per-turn text lives only in the audit trail (`session.runs[N].turns[M]`) — compaction never touches it.

## Tools & dispatch

**8. Tool panics don't crash anything — they become soft errors.**
The model sees "tool 'x' panicked: ...". Still, fix the panic; the message is diagnostics, not a strategy.

**9. Observers must pair tool events by `tool_call_id`.**
Arrival order lies under parallel dispatch and retries. `(turn, tool)` also lies — two calls to one tool in one turn share it.

**10. Retries re-fire everything per attempt.**
Observers, hooks, detection records, health recordings — all per attempt, in both dispatch modes. Design observers and thresholds accordingly.

**11. `ToolSchema`'s name field is `tool`, not `name`.**
Everyone trips once.

**12. Registering two tools with the same name silently replaces the first** (a warn log, original position kept). If two of your tools vanished into one — check names.

**13. Images don't reach providers yet.**
The data model carries image parts end to end, but all shipped provider converters currently drop them. Vision needs a custom `ApiClient`.

**14. Tools must be cancellation-safe.**
A cancel drops the tool's future mid-flight — no polite cleanup. Write to temp + rename; use transactions.

## Context & compaction

**15. Exactly-at-threshold does not compact (strict comparison); exactly-at-95% does (inclusive).**
The emergency line uses `>=`, the threshold line uses `>`. One token can matter in tests.

**16. `auto_compact: false` does NOT disable the emergency line.**
Only `context_window: 0` disables all window policy — and that also disables overflow protection.

**17. `context_window` must match your real model.**
The default (200,000) is wrong for most local models. A too-big window means real overflows (provider 400s); too-small means needless compaction.

**18. A pre-compact hook veto at over-threshold ends the run.**
Nothing shrank → the no-progress guard fires `ContextExceeded`. A veto is a decision to stop, not to proceed.

**19. The truncator can't shrink short-but-fat conversations.**
Fewer than `min_messages` (6) messages pass through untouched — a 3-message conversation with 200k tokens of content reports NoAction and the run ends. Summarizers don't have this floor.

## Streaming & providers

**20. Delta callbacks fire for failed attempts too.**
Concatenating `on_text_delta` fragments without honoring attempt boundaries yields duplicated/garbled text. Use `on_response` for committed text, or reset on retry.

**21. Ollama streams report no usage** (the profile disables `stream_usage` for compatibility). Code against `Option<Usage>`.

**22. A fallback manager whose primary differs from the client's model silently reroutes every request.**
The manager's routing wins. Keep the names in sync, or embrace it deliberately.

**23. Bedrock doesn't support `RequestOptions`** (model overrides, response formats, constraints) — those requests are rejected loudly, not silently degraded.

**24. Empty `Vec` of tools is never sent** — fine — but a `response_format` suppresses tools for that request entirely (Q&A turn, not tool turn).

## Safety systems

**25. Detection counts recovery attempts.**
A flaky tool failing 3 retries looks like a repeating operation to the loop detector. Mark recoverable errors in your `ToolSignature` (`is_recoverable_error`) — the doc calls overriding it "critical" for exactly this.

**26. Loop-stop counts are window-relative.**
Enough distinct traffic between repetitions can slide them out of the window (default 50 ops). Raise `max_history` if slow loops must be caught.

**27. Repeated shield blocks open the tool's circuit breaker.**
Once open, the model sees "temporarily unavailable" (breaker gate) instead of the shield's reason. Precedence is pinned; don't be surprised.

**28. `Ask` becomes `Block` in headless sessions.**
Both hooks and permission middleware deny without an interactive resolver. Safe default; wire a resolver if you have a human.

**29. Memoize has no capacity limit.**
Long sessions accumulate entries until TTL expiry. Pair with a short TTL or write a bounded cache.

**30. `serde_json`'s `preserve_order` feature (anywhere in your tree) breaks memoize key canonicalization.**
`{"a":1,"b":2}` stops equaling `{"b":2,"a":1}`. Rare, brutal to diagnose — check your dependency tree.

## Misc

**31. `ToolRecoveryExhausted.attempts` counts total calls (6 = original + 5 retries).**
Subtract 1 for the retry count.

**32. The engine stamps tool result ids after the pipeline.**
Middleware can't corrupt model call↔result pairing — stop worrying about it, and don't try to "fix" ids yourself.

**33. `StreamCapable::stream_handler()` never returns None** — an unset handler yields an invisible passthrough (no retries, no timeouts). Always configure one for production.

**34. AutoCommitHook stages only recorded files — never `git add -A`.**
Default config + dirty tree + no tracked tool calls = a `Failed` result by design. It would rather fail loudly than commit unrelated changes.

**35. Convergence detection is word-overlap, not meaning.**
Paraphrases slip through; boilerplate false-positives. Hence the warn-only default — don't turn on `Stop` without weighing it.

---

Cross-referenced deep dives: [engine](../02-engine/02-driver-loop.md) · [compaction](../02-engine/06-compaction.md) · [middleware](../03-safety/01-middleware.md) · [detection](../03-safety/02-loop-detection.md) · [streaming](../01-core-data/04-stream-events.md).
