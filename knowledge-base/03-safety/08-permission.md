# Permissions — allow, deny, ask, modify — and the record of why

Should this tool call be allowed to run? loopctl's permission model is one small enum, `PermissionCheck` (in `src/tool/permission.rs`), consumed by `PermissionMiddleware`. There is deliberately no built-in policy engine — *you* write the policy as a function; the framework provides the decision vocabulary, the enforcement point, and (since 0.4.0) the **audit record**: every decision lands as serializable `GateDecision` data.

---

## The decision type

```rust
pub enum PermissionCheck {
    Allow,                          // proceed
    Deny { reason: String },        // refuse; the reason reaches the model
    Ask { prompt: String },         // require human approval
    Modify { modified_input: Value },// run — but with replaced arguments
}
```

Constructors and checks: `PermissionCheck::allow()`, `.deny("...")`, `.ask("...")`, `.modify(json)`, `is_allow()` / `is_deny()` / `is_ask()` / `is_modify()`.

What each produces in the [middleware](01-middleware.md) (the enforcement point):

| Decision | Outcome |
|---|---|
| `Allow` | next layer runs |
| `Deny { reason }` | **short-circuit** — soft error `"Permission <reason> for tool 'x'"`, zero duration; nothing inside executes |
| `Ask { prompt }` | your async resolver answers; `true` → proceed, `false` → soft error "denied by user" (logged at `warn`, like every other denial — 0.3.2). **No resolver configured → denied** (safe default for headless agents). A cancel while the answer is pending aborts the wait (`cancelled while awaiting approval`) — an unresponsive resolver cannot hold a cancelled run open, and a cancellation that already fired when the answer lands wins deterministically: a cancelled run never executes the tool |
| `Modify { input }` | `ctx.input` is replaced, then the call proceeds |

> **Gotcha:** `Modify`'s replacement is **not re-validated** against the tool's schema. If your policy rewrites arguments, keep them valid yourself.

**Writing good reasons matters** — the reason text is what the model reads *and* what the audit record carries. `"shell execution is disabled in this session"` lets the model pick another path; `"denied"` teaches it nothing. For `Ask` prompts, name the effect: `"Allow write to /etc/config.yaml?"`.

---

## Gate decisions as data (0.4.0)

Asks, plan mode, audit, and gate replay all need the decision itself as a serializable record. Every decision the permission middleware makes now mints one `GateDecision`:

```text
{ tool, args_digest, verdict, rule_id, rule_source, matched_pattern, reason, ts }
```

- **`args_digest`** — 16 hex characters, FNV-1a-64 over the input's *canonical* JSON (every object's keys sorted, recursively, whichever `serde_json` map backend your graph resolves to). Key order never moves it; any argument change produces a different digest; the call's arguments themselves are never stored. For a rewritten call, the digest is of the **original** input — it identifies the call the model made.
- **`verdict`** — all nine paths: `Allow`, `AllowModified`, `Deny`, `Ask` (the pre-resolution answer), `AskAllowed`, `AskDenied`, `AskUnresolved` (headless: no resolver), `AskExpired` (the ask deadline), `Cancelled` (the cancel-raced prompt — distinct from a refusal).
- **`rule_id` + `rule_source`** — provenance: `"middleware"` for an unnamed check, the id a `with_named_check(rule_id, f)` rule carries verbatim, `"context"` for a per-call claim, `"ask"`/`AskResolver` when the user's answer decided, `Engine` for engine-policy outcomes (the [ask channel's](09-approvals.md) expiry/cancel/headless records).
- **`ts`** — stamped by the engine from its clock seam at emission (a record read straight off a dispatch result before emission carries `0`).

The record rides the dispatch result out to the engine, which emits it through the `on_gate_decision` observer (`tool_pre → gate → tool_post` order, paired by `call_id` with the `tool.call`/`tool.result` ledger lines). **Exactly one record per gated dispatch**: an ask that resolves emits the resolution, not the step; a dispatch no gate consulted emits none. Compositions stay honest — a memoize cache hit clears the gate, and stacked permission layers attach records through a precedence lattice (deny-family over `AllowModified` over pass-through) so the record that *decided* the outcome survives.

### Evaluate without executing

`PermissionMiddleware::evaluate(tool_name, input)` resolves a synthetic dispatch through the middleware's **real** rule stack — so a `plan`-style dry-run uses the engine's policy, not a parallel one. An `Ask` evaluates to `Ask` with the prompt in `reason` (a dry-run never consults the resolver).

---

## Where decisions come from

Three sources, in practice:

**1. A policy function** (the common case):

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

**2. The context itself** — `from_context()` (no check function) honors whatever `ctx.permission` carries. The engine seeds `Allow` for every dispatch; a middleware earlier in the chain can tighten it.

**3. Ready-made extremes** — `deny_all()` (a sandbox: nothing runs, everything gets "blocked by policy") and `allow_all()` (pass-through, useful for testing a pipeline with the permission slot occupied).

The `Ask` resolver is async (`AskResolverFn`), so a real integration can call a UI, a webhook, an approval service. While it resolves, dispatch waits — the timeout middleware (if outside the permission layer) still bounds the whole thing, and since 0.3.2 the dispatch's cancel signal does too: a cancelled pipeline stops awaiting and denies with `cancelled while awaiting approval` instead of waiting out an unresponsive resolver.

---

## The related knobs on tools themselves

Two `Tool` trait methods feed permission thinking:

- **`is_read_only()`** — declares the tool changes nothing. A policy can auto-approve read-only tools and only gate the rest: the classic "reads flow freely, writes ask."
- **`ToolContext::is_non_interactive`** — the "no human is present" flag. Tools and gates should fail with `ToolError::Permission` rather than trying to prompt in non-interactive contexts.

`FnTool` users: `.read_only()` sets the flag.

---

## How this relates to hooks

There are two blocking mechanisms in loopctl and the difference is placement:

| | `PermissionMiddleware` | pre-tool-use [hooks](../04-extensions/02-hooks.md) |
|---|---|---|
| Lives in | the tool pipeline | the hook executor, outside the pipeline |
| Decides with | a function over `ToolDispatchContext` | `HookAction` (Allow/Block/Ask) over `PreToolUseContext` |
| Extra powers | `Modify` (input rewriting) | shares one executor with run/compact events; first-block-wins across all hooks |
| Right for | per-call policy, input-aware rules, renames | session-wide rules ("never the `rm` tool"), audit-driven gates |

They compose: hooks run first (engine-level), then the pipeline's permission layer. If both allow, the tool runs. And since 0.4.0 there is a third piece: a hook's `Ask` can **park the run** through the [ask channel](09-approvals.md) instead of resolving synchronously, and approvals can persist as grants there so re-asking is automatic only when something changed.

---

## Related pages

- [Middleware](01-middleware.md) — the enforcement mechanics.
- [Hooks](../04-extensions/02-hooks.md) — the other gate.
- [The shield](07-tool-shield.md) — risk scoring as an alternative to explicit rules.
