# Permissions — allow, deny, ask, modify

Should this tool call be allowed to run? loopctl's permission model is one small enum, `PermissionCheck` (in `src/tool/permission.rs`), consumed by `PermissionMiddleware`. There is deliberately no built-in policy engine — *you* write the policy as a function; the framework provides the decision vocabulary and the enforcement point.

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
| `Ask { prompt }` | your async resolver answers; `true` → proceed, `false` → soft error "denied by user". **No resolver configured → denied** (safe default for headless agents) |
| `Modify { input }` | `ctx.input` is replaced, then the call proceeds |

> **Gotcha:** `Modify`'s replacement is **not re-validated** against the tool's schema. If your policy rewrites arguments, keep them valid yourself.

**Writing good reasons matters** — the reason text is what the model reads. `"shell execution is disabled in this session"` lets the model pick another path; `"denied"` teaches it nothing. For `Ask` prompts, name the effect: `"Allow write to /etc/config.yaml?"`.

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

The `Ask` resolver is async (`AskResolverFn`), so a real integration can call a UI, a webhook, an approval service. While it resolves, dispatch waits — the timeout middleware (if outside the permission layer) still bounds the whole thing.

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

They compose: hooks run first (engine-level), then the pipeline's permission layer. If both allow, the tool runs.

---

## Related pages

- [Middleware](01-middleware.md) — the enforcement mechanics.
- [Hooks](../04-extensions/02-hooks.md) — the other gate.
- [The shield](07-tool-shield.md) — risk scoring as an alternative to explicit rules.
