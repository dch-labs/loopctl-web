---
title: "Recipes — complete, working patterns"
sidebar:
  order: 2
---


Copy-paste starting points for the most common agent builds. Every recipe is complete: features to enable, code to write, and what to watch for.

---

## Recipe 1 — Minimal agent against a local model

**Features:** `ollama` (or `openai`), `derive`, `testing` (dev).

```rust
use loopctl::{provider, engine::{BareLoop, RunConfig}, engine::core::Loop, tool::ToolRegistry};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = provider::ollama("qwen3")?;          // local Ollama server
    let mut tools = ToolRegistry::new();
    // ... register tools (Recipe 2) ...

    let mut agent = BareLoop::new(client.into(), tools, Default::default());
    let run = agent.run("List the files in this directory.", &RunConfig::default()).await?;
    println!("{}", run.output.unwrap_or_default());
    Ok(())
}
```

## Recipe 2 — A typed tool, end to end

**Features:** `derive`.

```rust
use loopctl::{Tool, ToolContext, ToolOutput, ToolError};
use serde::Deserialize;

/// Read a text file from the working directory.
#[derive(Tool, Deserialize)]
#[tool(read_only)]
struct ReadFile {
    /// Path relative to the working directory.
    path: String,
}

impl ReadFile {
    async fn run(&self, _input: Self, ctx: &ToolContext)
        -> Result<ToolOutput, ToolError>
    {
        match tokio::fs::read_to_string(format!("{}/{}", ctx.cwd, self.path)).await {
            Ok(text) => Ok(ToolOutput::text(text)),
            Err(e) => Err(ToolError::Io(e)),
        }
    }
}

tools.register(ReadFile { path: String::new() });
```

Watch for: [output caps](/safety/middleware/) — an uncapped `ReadFile` can eat the whole context window (Recipe 5).

## Recipe 3 — Ctrl-C that actually stops the agent

```rust
let cancel = agent.cancel_signal();
tokio::spawn(async move {
    if tokio::signal::ctrl_c().await.is_ok() {
        cancel.cancel();
    }
});

match agent.run(input, &RunConfig::default()).await {
    Ok(run) => { /* ... */ }
    Err(loopctl::error::LoopError::Cancelled) => println!("stopped cleanly"),
    Err(e) => eprintln!("error: {e}"),
}
// The agent is immediately reusable — the signal re-armed itself.
```

## Recipe 4 — Production hardening: retries, fallback, timeouts

```rust
use loopctl::stream::StreamHandler;
use loopctl::managers::LoopManagers;
use loopctl::fallback::FallbackManager;
use loopctl::reflection::{LlmReflector, ExponentialBackoffRecovery};

// Streaming resilience: retries, timeouts, rate-limit ladder, non-streaming rescue.
let handler = StreamHandler::new();                    // sensible defaults

// Model fallback: 3 failures → switch; 60s cooldown → probe; 2 successes → return.
let mut fallback = FallbackManager::default();
fallback.set_fallback_models(vec!["backup-model".into()]);

// Tool retries: the model analyzes its own failures.
let reflector = LlmReflector::new(client.clone());

let managers = LoopManagers::new()
    .with_fallback(fallback)
    .with_stream_handler(handler);

let mut agent = BareLoop::new_with_managers(client, tools, config, managers);
agent.set_reflector(reflector.into());
agent.set_recovery_strategy(ExponentialBackoffRecovery::new(3).into());
```

## Recipe 5 — A sane middleware pipeline

```rust
use loopctl::middleware::*;

let builder = ToolPipeline::builder()
    .with_middleware(PermissionMiddleware::from_context().with_check(my_policy)) // 1. gate
    .with_middleware(TimeoutMiddleware::from_secs(60))                           // 2. clock
    .with_middleware(OutputLimitMiddleware::new(16_384))                          // 3. cap
    .with_middleware(UnknownToolMiddleware::new(registry_arc));                   // 4. suggest
agent.set_pipeline(builder)?;
```

Order = execution order; first registered is outermost. Rationale per slot: [the middleware page](/safety/middleware/).

## Recipe 6 — Human approval for dangerous tools

```rust
// Hooks route (engine-level, no human → deny):
let mut executor = HookExecutor::new();
executor.register(Arc::new(ConfirmationHook::new(
    vec!["Bash".into()],
    Arc::new(TerminalPrompt),
)));
agent.set_hook_executor(Arc::new(executor));

// Or middleware route (with async approval UI):
let mw = PermissionMiddleware::from_context()
    .with_check(|ctx| if ctx.tool_name == "Bash" {
        PermissionCheck::ask("run this command?")
    } else { PermissionCheck::allow() })
    .with_ask_resolver(|prompt, _tool| async move { approval_webhook(prompt).await });
```

## Recipe 7 — Save the conversation, resume tomorrow

```rust
// Pause: extract the brain (pure data) and serialize it.
let machine = agent.into_machine();
std::fs::write("agent.json", serde_json::to_vec(&machine)?)?;

// Resume: give the brain a new body.
let machine: LoopMachine = serde_json::from_slice(&std::fs::read("agent.json")?)?;
let mut agent = BareLoop::from_machine(machine, config, client, tools);
// conversation() is intact; the next run() continues where you left off.
```

## Recipe 8 — Watch everything (metrics + live text)

```rust
struct Telemetry { /* your counters */ }
impl LoopObserver for Telemetry {
    fn name(&self) -> &str { "telemetry" }
    fn on_run_end(&self, ctx: &RunEndContext) {
        metrics::record_run(ctx.success, ctx.total_turns, ctx.duration_ms);
    }
    fn on_tool_post(&self, ctx: &ToolPostContext) {
        metrics::record_tool(ctx.tool.as_str(), ctx.is_error, ctx.duration);
    }
    fn on_compaction(&self, ctx: &CompactedContext) {
        metrics::record_compaction(ctx.tokens_saved);
    }
}
agent.register_observer(Arc::new(Telemetry { /* ... */ }));

// Live streaming text, the simple way:
agent.set_text_streamer(Arc::new(|chunk| print!("{chunk}")));
```

## Recipe 9 — Small local model, full guardrails

```rust
use loopctl::presets::ConstrainedProfile;

let mut agent = BareLoop::new(client, tools, ConstrainedProfile::session_config());
agent.set_request_options(ConstrainedProfile::request_options());
ConstrainedProfile::apply(&mut agent)?;
// Upgrade path: swap NoopVerifier for a real one (Recipe 10).
```

## Recipe 10 — Verify every write

```rust
struct CargoCheck;
impl Verifier for CargoCheck {
    fn verify<'a>(&'a self, ctx: &'a ToolContext, _tool: &'a str)
        -> Pin<Box<dyn Future<Output = VerifyResult> + Send + 'a>>
    {
        Box::pin(async move {
            let out = tokio::process::Command::new("cargo")
                .arg("check").current_dir(&ctx.cwd).output().await;
            match out {
                Ok(o) if o.status.success() =>
                    VerifyResult { passed: true, diagnostics: String::from_utf8_lossy(&o.stdout).into() },
                Ok(o) =>
                    VerifyResult { passed: false, diagnostics: String::from_utf8_lossy(&o.stderr).into() },
                Err(e) => VerifyResult { passed: false, diagnostics: e.to_string() },
            }
        })
    }
}
VerifyMiddleware::new(Arc::new(CargoCheck), vec!["Write".into(), "Edit".into()])
```

Every successful write gets `"\n\n[verify] passed/failed: ..."` appended — the model reads the verdict and self-corrects.

## Recipe 11 — Import foreign tools over MCP

```rust
let mcp = McpClient::stdio(CommandSpec {
    program: "npx".into(),
    args: vec!["-y".into(), "@modelcontextprotocol/server-github".into()],
    ..Default::default()
})?;
let mut provider = McpToolProvider::connect(mcp, Some("gh".into()))?;
provider.register_into(&mut tools);   // gh__create_issue, gh__search_code, ...
```

## Recipe 12 — A deterministic test

```rust
#[tokio::test]
async fn tool_failure_reaches_the_model() {
    let client = MockApiClient::new("m").with_responses(vec![
        MockResponse { text: String::new(),
            tool_call: Some(MockToolCall { id: "c1".into(), name: "boom".into(),
                                           input: json!({}) }),
            stop_reason: "tool_use".into() },
        MockResponse { text: "I'll try another way.".into(),
            tool_call: None, stop_reason: "end_turn".into() },
    ]);
    let mut tools = ToolRegistry::new();
    tools.register(MockTool::new("boom", "always fails").with_result("exploded").with_error());

    let mut agent = BareLoop::new(Arc::new(client), tools, test_config());
    let run = agent.run("go", &RunConfig::default()).await.unwrap();
    assert_eq!(run.output.as_deref(), Some("I'll try another way."));
}
```

## Recipe 13 — Secrets never leave the tool layer

**Features:** `redaction`.

```rust
let redacting = RedactingMiddleware::new(
    SecretPatternSet::default_common()          // bearer, api keys, AWS, PEM, PATs...
        .with_pattern(SecretPattern {           // plus your own:
            kind: "internal_token",
            pattern: regex::Regex::new(r"int_[A-Za-z0-9]{32}").unwrap(),
        }),
);
// register it OUTER (before verifiers) so it also scrubs what they append
```

## Recipe 14 — Serve your tools to other agents

```rust
let adapter = McpServerAdapter::new(tools, ToolContext::default(),
                                    "my-toolbox".into(), "1.0".into());
let service = adapter.serve_stdio()?;
service.waiting().await;   // any MCP client can now use your tools
```

---

## Which recipe first?

| Goal | Start with |
|---|---|
| "Just make it work locally" | 1 + 2 |
| "It works — now make it survive reality" | 3 + 4 + 5 |
| "It touches my filesystem / production" | 6 + 10 (+ 13 if secrets flow) |
| "The model is small and wanders" | 9 |
| "I want proof it all works" | 12 |
