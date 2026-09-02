---
title: "`src/reflection.rs` — reflector and recovery traits"
---


The two-piece system for deciding what to do after a tool failure: analyze, then decide.

**Key items**

- `Reflector::analyze(error, tool_name, tool_input, tool_schema, context) -> FailureAnalysis` — plus `ReflectionError { Skipped, Internal }`.
- `FailureAnalysis { is_recoverable, root_cause, severity, correction, context }`; `FailureSeverity` — Low < Medium < High < Critical (ordered).
- `Correction { correction_type, description, modified_input?, alternative_tool?, guidance? }` and `CorrectionType` — InputFix, ToolChange, PrerequisiteFix, ApproachChange, Escalate.
- `RecoveryStrategy::decide(analysis, attempt, max_attempts) -> RecoveryAction` — `Retry { delay }`, `Skip`, `AskUser`, `Fail`.
- `NoopReflector` — the default: everything non-recoverable, severity Medium.
- `ReflectionContext { task, attempt (0-indexed), max_attempts }` — freshly built per failure.

**Behavior notes**

- Variant/field pairing on `Correction` is unenforced — consult `correction_type` before reading fields.
- `InputFix` requires a JSON **object** `modified_input`; failed corrections are logged and dropped, the retry still runs.
- Defaults mean **zero retries** (Noop says non-recoverable); `ExponentialBackoffRecovery` (in `backoff.rs`) is the default strategy with 3 retries under the engine's hard ceiling of 5.
- The engine maps reflector errors to conservative `Fail` — never guesses on top of a broken reflector.

Deep dive: [Reflection](/safety/reflection/).
