---
title: "Permissions"
sidebar:
  order: 8
---

Should this tool call be allowed to run? loopctl answers that with one small enum, `PermissionCheck`, consumed by `PermissionMiddleware`.

There is no built-in policy engine, deliberately. You write the policy as a function, and the framework gives you the decision vocabulary, the enforcement point, and the audit record that says why. Source: `src/tool/permission.rs`.

## The decision type

```rust
pub enum PermissionCheck {
    Allow,                          // proceed
    Deny { reason: String },        // refuse; the reason reaches the model
    Ask { prompt: String },         // require human approval
    Modify { modified_input: Value },// run — but with replaced arguments
}
```

Constructors: `PermissionCheck::allow()`, `.deny("...")`, `.ask("...")`, and `.modify(json)`. Checks: `is_allow()`, `is_deny()`, `is_ask()`, and `is_modify()`.

### What each decision does

The [middleware](/safety/middleware/) is the enforcement point, and each variant has a distinct outcome there:

| Decision | Outcome |
|---|---|
| `Allow` | The next layer runs. |
| `Deny { reason }` | Short-circuit, with a soft error and zero duration, so nothing inside executes. |
| `Ask { prompt }` | Your resolver answers, and the run continues only if that answer says yes. |
| `Modify { input }` | `ctx.input` is replaced, then the call proceeds. |

A denial reads "Permission <reason> for tool 'x'", which is the text your model sees.

### Ask waits for your answer

Your async resolver decides an `Ask`. A true answer lets the call through, and a false one returns a soft error reading "denied by user", logged at `warn` like every other denial.

No resolver configured means denied. That is the safe default for a headless agent.

A cancel while the answer is pending aborts the wait and denies with "cancelled while awaiting approval", so an unresponsive resolver cannot hold a cancelled run open. If the cancel already fired when your answer lands, the cancel wins deterministically, and a cancelled run never executes the tool.

### The one thing Modify does not do

Gotcha: `Modify`'s replacement is not re-validated against the tool's schema. If your policy rewrites arguments, keep them valid yourself.

### Reasons the model can act on

The reason text is what your model reads, and the same string rides the audit record. `"shell execution is disabled in this session"` lets the model pick another path, while `"denied"` teaches it nothing. For an `Ask` prompt, name the effect instead: `"Allow write to /etc/config.yaml?"`.

## The audit record

Asks, plan mode, audit, and gate replay all need the decision itself as data, a serializable record you can store.

That arrived in 0.4.0, and every decision your permission middleware makes mints one `GateDecision`:

```text
{ tool, args_digest, verdict, rule_id, rule_source, matched_pattern, reason, ts }
```

### args_digest

This is 16 hex characters, FNV-1a-64 over the input's canonical JSON, which means every object's keys sorted recursively, whichever `serde_json` map backend your graph resolves to. Key order never moves it, and any argument change produces a different digest. The call's arguments themselves are never stored.

For a rewritten call the digest covers the original input, because it identifies the call your model made.

### verdict

Nine verdicts cover every path:

- `Allow`, `AllowModified`, and `Deny`.
- `Ask` is the pre-resolution answer, and your user's reply decides `AskAllowed` or `AskDenied`.
- `AskUnresolved` marks a headless run with no resolver, and `AskExpired` marks the ask deadline.
- `Cancelled` marks a prompt your cancel raced, and that is distinct from a refusal.

### rule_id and rule_source

These carry provenance. An unnamed check reports `"middleware"`, and a rule you set with `with_named_check(rule_id, f)` carries your id verbatim. A per-call claim reports `"context"`.

An answer from your user reports `"ask"` with `AskResolver` as the source. Engine policy reports `Engine`, which is how the [ask channel's](/safety/approvals/) expiry, cancel, and headless records get labelled.

### ts

The engine stamps this from its clock seam at emission. A record you read straight off a dispatch result before emission carries `0`.

### One record per gated dispatch

The record rides the dispatch result out to the engine, which emits it through the `on_gate_decision` observer. Ordering is `tool_pre → gate → tool_post`, and `call_id` pairs it with the `tool.call` and `tool.result` ledger lines.

Exactly one record lands per gated dispatch. An ask that resolves emits the resolution rather than the step, and a dispatch no gate consulted emits none.

Compositions stay honest. A memoize cache hit clears the gate, and stacked permission layers attach records through a precedence lattice: deny-family over `AllowModified` over pass-through. The record that decided the outcome is the one that survives.

### Evaluate without executing

`PermissionMiddleware::evaluate(tool_name, input)` resolves a synthetic dispatch through the middleware's real rule stack, so a `plan`-style dry-run uses the engine's policy rather than a parallel one. An `Ask` evaluates to `Ask` with the prompt in `reason`, because a dry run never consults your resolver.

## Where decisions come from

Three sources cover practice.

**A policy function** is the common case:

```rust
let middleware = PermissionMiddleware::from_context().with_check(|ctx| {
    let tool = ctx.tool_name;
    let path = ctx.input["path"].as_str().unwrap_or("");

    if tool == "Write" && path.starts_with("/etc") {
        return PermissionCheck::deny("writes to /etc are not allowed");
    }
    if tool == "Bash" {
        return PermissionCheck::ask(format!("Allow command: {}?",
            ctx.input["command"].as_str().unwrap_or("")));
    }
    PermissionCheck::allow()
});
```

**The context itself** works when you call `from_context()` with no check function. That honors whatever `ctx.permission` carries. The engine seeds `Allow` for every dispatch, and a middleware earlier in the chain can tighten it.

**Ready-made extremes** cover the two ends:

- `deny_all()` is a sandbox. Nothing runs, and everything gets "blocked by policy".
- `allow_all()` is pass-through. Use it when you test a pipeline and need the permission slot occupied.

### Your resolver can be remote

An `Ask` resolver is an async `AskResolverFn`, so a real integration can call a UI, a webhook, or an approval service. Dispatch waits while it resolves.

Two things bound that wait. The timeout middleware bounds the whole call if it sits outside your permission layer, and since 0.3.2 the dispatch's cancel signal does too. A cancelled pipeline stops awaiting and denies with "cancelled while awaiting approval" instead of waiting out an unresponsive resolver.

## The knobs on tools themselves

Two `Tool` trait methods feed your policy:

- `is_read_only()` declares that the tool changes nothing. Your policy can then auto-approve read-only tools and gate only the rest, which is the classic split where reads flow freely and writes ask.
- `ToolContext::is_non_interactive` is the flag for "no human is present". In those contexts, tools and gates should fail with `ToolError::Permission` rather than try to prompt.

If you build tools with `FnTool`, call `.read_only()` to set that flag.

## How this relates to hooks

loopctl has two blocking mechanisms, and the difference is placement:

| | `PermissionMiddleware` | Pre-tool-use [hooks](/extensions/hooks/) |
|---|---|---|
| Lives in | The tool pipeline. | The hook executor, outside the pipeline. |
| Decides with | A function over `ToolDispatchContext`. | A `HookAction` of `Allow`, `Block`, or `Ask` over `PreToolUseContext`. |
| Extra powers | `Modify`, which rewrites input. | One executor shared with run and compact events, and first-block-wins across all hooks. |
| Right for | Per-call policy, input-aware rules, renames. | Session-wide rules like never using the `rm` tool, and audit-driven gates. |

They compose. Hooks run first at engine level, then your pipeline's permission layer, and the tool runs only if both allow.

A hook's `Ask` is the third piece in this picture. It can park the run through the [ask channel](/safety/approvals/) instead of resolving synchronously, and approvals can persist there as grants, so re-asking happens only when something changed.

## Related pages

- [Middleware](/safety/middleware/) covers the enforcement mechanics.
- [Hooks](/extensions/hooks/) is the other gate.
- [The shield](/safety/tool-shield/) scores risk instead of following explicit rules.
