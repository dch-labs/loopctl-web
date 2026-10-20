---
title: "Gotchas"
sidebar:
  order: 1
---

Every sharp edge in loopctl is in one place here. Each entry says what happens, why it happens, and what you should do instead.

The entries are organized by area, and the worst ones come first.

## Engine and runs

### 1. Default settings give tools zero retries

The stock reflector, `NoopReflector`, marks every failure non-recoverable, so each tool call gets exactly one attempt. Install a reflector from [reflection](/safety/reflection/) if you want retry behavior.

### 2. Setters must run before the first run

Call `set_memory`, `set_pipeline`, `register_observer`, and their siblings on a freshly built agent. Debug builds panic with `debug_assert_idle`, and release builds misbehave quietly.

### 3. A failed run keeps its completed turns, unless it compacted

Since 0.4.0, a cancel or an ordinary failure salvages the coherent prefix, which means completed turns commit and the in-flight exchange drops. Only the `ContextExceeded` family discards whole.

Compaction is a commit point, because it folds the scratchpad into history. So a run that compacted and then failed leaves the compacted history behind. Do not expect "failed run means nothing changed" after mid-run compaction.

### 4. max_turns counts model turns, not tool calls

One turn can contain many tool calls, since a whole parallel wave is one turn. The default is 200 turns, and that is a lot of work.

### 5. User input reaches the model only through the scratchpad

Do not simplify by passing your input through custom plumbing, because you will send it twice or not at all. Your input rides `accept_input`, then `pending`, then every request via `full_history()`.

### 6. Two token counters cause flapping compaction

Your trigger decisions and your post-compaction measurements must share one counter. Install it on the `ContextManager` and the driver follows it automatically.

Mixing a heuristic with real tokenizer counts makes compaction chase its tail.

### 7. session.runs is the recovery source after compaction

After the conversation is summarized, the original per-turn text lives only in the audit trail at `session.runs[N].turns[M]`, and compaction never touches it.

## Tools and dispatch

### 8. Tool panics do not crash anything

A panic becomes a soft error, so your model sees "tool 'x' panicked: ...". Still fix the panic, because that message is diagnostics rather than a strategy.

### 9. Observers must pair tool events by tool_call_id

Arrival order lies under parallel dispatch and retries. A `(turn, tool)` pair also lies, because two calls to one tool in one turn share it.

### 10. Retries re-fire everything per attempt

Observers, hooks, detection records, and health recordings all run per attempt, in both dispatch modes. Design your observers and thresholds accordingly.

### 11. The name field on ToolSchema is called tool

Everyone trips on this once. The field is `tool`, not `name`.

### 12. Registering two tools with the same name silently replaces the first

You get a warn log and the original position is kept. If two of your tools vanished into one, check your names.

### 13. Images do not reach providers yet

Your data model carries image parts end to end, but all shipped provider converters currently drop them. Vision needs a custom `ApiClient`.

### 14. Tools must be cancellation-safe

A cancel drops your tool's future mid-flight, with no polite cleanup. Write to a temp file and rename, or use transactions.

## Context and compaction

### 15. Exactly at threshold does not compact, and exactly at 95 percent does

The threshold line uses a strict `>` and the emergency line uses `>=`. One token can matter in your tests.

### 16. Setting auto_compact to false does not disable the emergency line

Only `context_window: 0` disables all window policy, and that also disables your overflow protection.

### 17. The context_window must match your real model, or trust the probe

The default of 200,000 is wrong for most local models.

Since 0.4.0 a client that discloses its real window outranks the declaration at run start, which covers llama.cpp through `/props` divided by slots and Ollama through `/api/show`. The hosted APIs disclose nothing, so your declared number still rules there.

A too-big window means real overflows, which is one overflow-salvage retry and then `ContextExceeded`. A too-small window means needless compaction.

### 18. A pre-compact hook veto at over-threshold ends the run

Nothing shrank, so the no-progress guard fires `ContextExceeded`. A veto is a decision to stop rather than to proceed.

### 19. The truncator cannot shrink short but fat conversations

Fewer than `min_messages` messages, which is 6, pass through untouched. So a 3-message conversation with 200k tokens of content reports NoAction and your run ends.

The LLM compactors do not have this floor, and the `FallbackCompactor` chain makes "compaction failed" a non-event, since it falls through to the truncate terminal.

### 20. New defaults since 0.4.0, so check your assumptions

Default construction now wires the small-model profile: the builtin-verified pipeline, the goal reminder, and strict tool-calls where the client supports them. `FrontierProfile` is the opt-out.

The compaction landing target tightened to 15% of the threshold line, where it was 70%. The `Read` tool's default window is 400 lines and 32 KiB, where it was 2,000 lines and 400 KB.

Builtin wire names are now CamelCase, such as `Read`, `Think`, and `Write`, so gate rules and prompts written against lowercase names need updating.

Prior-turn thinking rides the conversation verbatim. That gives you better prompt-cache hits, and it means reasoning-heavy models will compact more often.

## Streaming and providers

### 21. Delta callbacks fire for failed attempts too

If you concatenate `on_text_delta` fragments without honoring attempt boundaries, you get duplicated or garbled text. Use `on_response` for committed text, or reset on retry.

### 22. Ollama streams report no usage

The profile disables `stream_usage` for compatibility, so code against `Option<Usage>`.

### 23. A fallback manager whose primary differs from the client's model silently reroutes every request

The manager's routing wins. Keep the names in sync, or embrace it deliberately.

### 24. Bedrock does not support RequestOptions

Model overrides, response formats, and constraints are all rejected loudly on those requests rather than silently degraded.

### 25. An empty tools vector is never sent

That part is fine. Note though that a `response_format` suppresses tools for that request entirely, so it is a Q&A turn rather than a tool turn.

## Safety systems

### 26. Detection counts recovery attempts

A flaky tool failing 3 retries looks like a repeating operation to the loop detector. Mark recoverable errors in your `ToolSignature` with `is_recoverable_error`, since the doc calls overriding it critical for exactly this reason.

### 27. Loop-stop counts are window-relative

Enough distinct traffic between repetitions can slide them out of the window, which defaults to 50 ops. Raise `max_history` if slow loops must be caught.

### 28. Repeated shield blocks open the tool's circuit breaker

Once the breaker is open, your model sees "temporarily unavailable" from the breaker gate instead of the shield's reason. The precedence is pinned, so do not be surprised.

### 29. Ask without a resolver becomes Block in headless sessions

Both hooks and permission middleware deny without an interactive resolver, which is the safe default and leaves one `AskUnresolved` gate record.

Since 0.4.0, when you install an ask resolver through `ApprovalChannel::pair`, a hook's `Ask` instead parks your run for an async answer. That comes with a deadline, fail-closed drops, and one gate record per ending.

### 30. Memoize has no capacity limit

Long sessions accumulate entries until TTL expiry. Pair it with a short TTL or write a bounded cache.

### 31. The preserve_order feature on serde_json breaks memoize key canonicalization

If that feature appears anywhere in your tree, `{"a":1,"b":2}` stops equaling `{"b":2,"a":1}`. It is rare and brutal to diagnose, so check your dependency tree.

## Misc

### 32. ToolRecoveryExhausted.attempts counts total calls

Six means the original plus 5 retries, so subtract 1 for the retry count.

### 33. The engine stamps tool result ids after the pipeline

Middleware cannot corrupt your model's call-and-result pairing, so stop worrying about it and do not try to fix ids yourself.

### 34. stream_handler never returns None

An unset handler yields an invisible passthrough with no retries and no timeouts. Always configure one for production.

### 35. AutoCommitHook stages only recorded files

It never runs `git add -A`. Default config plus a dirty tree plus no tracked tool calls gives you a `Failed` result by design, because it would rather fail loudly than commit unrelated changes.

### 36. Convergence detection is word overlap, not meaning

Paraphrases slip through and boilerplate false-positives. That is why the default is warn-only, so do not turn on `Stop` without weighing it.

### 37. Removing a tool mid-run does not stop its in-flight calls (0.4.1)

Dispatch holds an owned handle, so a running call drains to completion. Only the next call to that name fails the unknown-tool path. Cancel your run if you need the execution itself to stop.

### 38. A steering push into an idle loop is refused (0.4.1)

`push` returns `false` and stores nothing when no run is in flight. A UI that fire-and-forgets loses the message silently, so check the return value. Keep the message and send it as ordinary input instead.

### 39. The whitespace-tolerant Edit keeps the file's formatting (0.4.1)

An `old_text` that matches modulo indentation applies with the file's own indentation, line endings, and indent characters. The receipt discloses it with `matched with normalized indentation`. An ambiguous normalized match still refuses with the file's lines echoed.

For cross-referenced deep dives, see [engine](/engine/driver-loop/), [compaction](/engine/compaction/), [middleware](/safety/middleware/), [detection](/safety/loop-detection/), and [streaming](/core-data/stream-events/).
