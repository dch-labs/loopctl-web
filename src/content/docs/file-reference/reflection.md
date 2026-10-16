---
title: "src/reflection.rs"
---

This file declares your two-piece system for deciding what to do after a tool failure: analyze, then decide.

You write one type that inspects what broke and explains it, and another that chooses whether to retry, skip, ask, or quit.

## Key items

`Reflector::analyze(error, tool_name, tool_input, tool_schema, context) -> FailureAnalysis` is the analyze half, and `ReflectionError { Skipped, Internal }` is how it declines.

`FailureAnalysis { is_recoverable, root_cause, severity, correction, context }` is the report. `FailureSeverity` orders Low, Medium, High, Critical, and Low < Medium < High < Critical holds.

`Correction { correction_type, description, modified_input?, alternative_tool?, guidance? }` pairs with `CorrectionType`: InputFix, ToolChange, PrerequisiteFix, ApproachChange, and Escalate.

`RecoveryStrategy::decide(analysis, attempt, max_attempts) -> RecoveryAction` is your decide half, answering `Retry { delay }`, `Skip`, `AskUser`, or `Fail`.

`NoopReflector` is your default: everything is non-recoverable, and severity is Medium.

`ReflectionContext { task, attempt (0-indexed), max_attempts }` is built freshly per failure, so your strategy can compare what it already tried.

## Behavior notes

Variant and field pairing on `Correction` is unenforced, so consult `correction_type` before you read fields.

`InputFix` requires a JSON object as `modified_input`. Failed corrections are logged and dropped, and the retry still runs.

Defaults mean zero retries, because Noop says non-recoverable. `ExponentialBackoffRecovery`, in `backoff.rs`, is your default strategy with 3 retries under the engine's hard ceiling of 5.

Your engine maps reflector errors to a conservative `Fail`, and never guesses on top of a broken reflector.

Deep dive: [Reflection](/safety/reflection/).
