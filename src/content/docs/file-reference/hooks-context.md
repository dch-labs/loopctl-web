---
title: "src/hooks/context.rs"
---

This file holds the payloads your hooks receive, plus the `CompactResult` steering object a pre-compact hook returns. Read it when you wonder what a hook actually knows at the moment it fires.

## Key items

`RunStartContext { session_id, model, working_directory }` opens your run.

`RunEndContext { session_id, reason, total_turns, total_tokens, duration_secs }` closes it, and `RunEndReason` is one of `Complete`, `Cancelled`, `Error`, `MaxTurns`, or `ContextOverflow`.

`PreToolUseContext { tool_name, input, session_id, turn_number }` carries the exact JSON your tool will receive.

`PostToolUseContext { tool_name, input, output, is_error, duration_ms, session_id, turn_number }` carries what came back.

`CompactTrigger { Auto, Manual }` maps from `From<CompactReason>`, where threshold and emergency become Auto and manual stays Manual.

`PreCompactContext { trigger, custom_instructions, message_count, tokens_before, context_window, session_id }` reaches your hooks in order, so later hooks see earlier hooks' instructions accumulated.

`PostCompactContext { trigger, messages_compacted, tokens_saved, tokens_after, duration_ms, session_id }` reports what the pass achieved.

## Behavior notes

Your executor chains pre-compact results. The first `abort` wins and skips the remaining hooks, `new_instructions` is last-writer-wins, and `additional_context` accumulates, so the merged guidance genuinely reaches your compactor.

Deep dive: [Hooks](/extensions/hooks/).
