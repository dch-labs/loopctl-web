# `src/hooks/context.rs` — hook contexts and `CompactResult`

The payloads hooks receive — and the steering object a pre-compact hook returns.

**Key items**

- `RunStartContext { session_id, model, working_directory }`.
- `RunEndContext { session_id, reason, total_turns, total_tokens, duration_secs }`; `RunEndReason` — `Complete`, `Cancelled`, `Error`, `MaxTurns`, `ContextOverflow`.
- `PreToolUseContext { tool_name, input, session_id, turn_number }` — the exact JSON the tool will receive.
- `PostToolUseContext { tool_name, input, output, is_error, duration_ms, session_id, turn_number }`.
- `CompactTrigger { Auto, Manual }` (+ `From<CompactReason>`: threshold/emergency → Auto, manual → Manual).
- `PreCompactContext { trigger, custom_instructions, message_count, tokens_before, context_window, session_id }` — later hooks see earlier hooks' instructions accumulated.
- `PostCompactContext { trigger, messages_compacted, tokens_saved, tokens_after, duration_ms, session_id }`.

**Behavior notes**

- The executor chains pre-compact results: first `abort` wins and skips remaining hooks; `new_instructions` last-writer-wins; `additional_context` accumulates — the merged guidance genuinely reaches the compactor.

Deep dive: [Hooks](../04-extensions/02-hooks.md).
