---
title: "Recipes, complete working patterns"
sidebar:
  order: 2
---

These are copy-paste starting points for the most common agent builds. Every recipe is complete, so you get the features to enable, the code to write, and what to watch for.

## Recipe 1: Minimal agent against a local model

Enable the `ollama` feature, or `openai` instead, plus `derive`, and `testing` in dev.

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

## Recipe 2: A typed tool, end to end

Enable the `derive` feature.

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

Watch for [output caps](/safety/middleware/), because an uncapped `ReadFile` can eat your whole context window. Recipe 5 adds the cap.

## Recipe 3: Ctrl-C that actually stops the agent

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

## Recipe 4: Production hardening with retries, fallback, and timeouts

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

## Recipe 5: A sane middleware pipeline

```rust
use loopctl::middleware::*;

let builder = ToolPipeline::builder()
    .with_middleware(PermissionMiddleware::from_context().with_check(my_policy)) // 1. gate
    .with_middleware(TimeoutMiddleware::from_secs(60))                           // 2. clock
    .with_middleware(OutputLimitMiddleware::new(16_384))                          // 3. cap
    .with_middleware(UnknownToolMiddleware::new(registry_arc));                   // 4. suggest
agent.set_pipeline(builder)?;
```

Order is execution order, and the first registered layer is outermost. [The middleware page](/safety/middleware/) gives the rationale per slot.

## Recipe 6: Human approval for dangerous tools

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

## Recipe 7: Save the conversation and resume tomorrow

```rust
// Pause: extract the brain (pure data) and serialize it.
let machine = agent.into_machine();
std::fs::write("agent.json", serde_json::to_vec(&machine)?)?;

// Resume: give the brain a new body.
let machine: LoopMachine = serde_json::from_slice(&std::fs::read("agent.json")?)?;
let mut agent = BareLoop::from_machine(machine, config, client, tools);
// conversation() is intact; the next run() continues where you left off.
```

## Recipe 8: Watch everything, metrics plus live text

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

## Recipe 9: Small local model, full guardrails

```rust
use loopctl::presets::ConstrainedProfile;

let mut agent = BareLoop::new(client, tools, ConstrainedProfile::session_config());
agent.set_request_options(ConstrainedProfile::request_options());
ConstrainedProfile::apply(&mut agent)?;
// Since 0.4.0 this is also (almost) the default wiring — plain BareLoop::new
// installs the builtin-verified pipeline, the goal reminder, and strict
// tool-calls. FrontierProfile is the opt-out; ConstrainedProfile makes the
// 32k-window / 100-turn shape explicit.
```

## Recipe 10: Verify every write

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

Every successful write gets `"\n\n[verify] passed/failed: ..."` appended, so your model reads the verdict and self-corrects.

## Recipe 11: Import foreign tools over MCP

```rust
let mcp = McpClient::stdio(CommandSpec {
    program: "npx".into(),
    args: vec!["-y".into(), "@modelcontextprotocol/server-github".into()],
    ..Default::default()
})?;
let mut provider = McpToolProvider::connect(mcp, Some("gh".into()))?;
provider.register_into(&mut tools);   // gh__create_issue, gh__search_code, ...
```

## Recipe 12: A deterministic test

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

## Recipe 13: Secrets never leave the tool layer

Enable the `redaction` feature.

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

## Recipe 14: Serve your tools to other agents

```rust
let adapter = McpServerAdapter::new(tools, ToolContext::default(),
                                    "my-toolbox".into(), "1.0".into());
let service = adapter.serve_stdio()?;
service.waiting().await;   // any MCP client can now use your tools
```

## Recipe 15: Real compaction that never fails

This recipe arrived in 0.4.0.

```rust
use loopctl::compact::FallbackCompactor;

// QA → structured → truncate: best-effort summaries first, the deterministic
// terminal cannot fail, so an out-of-tokens condition stops being an error.
agent.set_context_manager(Arc::new(
    ContextManager::new(Arc::new(FallbackCompactor::default_chain(summarizer_client)))
        .with_context_window(32_000),
));
// Add the demotion sink and what compaction evicts becomes recallable memory.
```

## Recipe 16: A budget the engine enforces

This gate arrived in 0.4.0.

```rust
use loopctl::budget::{BudgetGate, BudgetLimits};

let limits = BudgetLimits::new().with_tokens(400_000).with_turns(50);
agent.with_budget_gate(BudgetGate::new(limits)?);
// 80% warns once (on_budget_warn); 100% refuses the NEXT request
// (Err(BudgetExhausted)) before it is sent — plus a budget.hard gate record.
```

## Recipe 17: Unattended runs with human approvals

This channel arrived in 0.4.0.

```rust
use loopctl::ask::ApprovalChannel;

let (channel, approver) = ApprovalChannel::pair(16);
// hand `approver` to your webhook/UI thread: approver.resolve(id, resolution)
let managers = LoopManagers::new()
    .with_ask_resolver(Arc::new(channel))
    .with_ask_timeout(Duration::from_secs(300));
// A hook's Ask now parks the run (no tool executes, the machine is coherent)
// until the answer, the deadline, or a cancel — one gate record per ending.
```

## Recipe 18: Semantic memory the model can search

This store arrived in 0.4.0.

```rust
use loopctl::memory::{VectorMemoryStore, SearchMemoriesTool};
use loopctl::provider::embeddings::OllamaEmbedder;
use loopctl::memory::LinearVectorIndex;   // or loopctl-hnsw / loopctl-vector

let memory = VectorMemoryStore::new(
    Box::new(OllamaEmbedder::from_env()?),
    Box::new(LinearVectorIndex::new()),
);
agent.set_memory(Arc::new(memory.clone()));
tools.register(SearchMemoriesTool::new(Arc::new(memory)));   // the model searches
// Pair with MemoryDemotionSink: what compaction evicts, the model recalls.
```

## Which recipe first?

| Goal | Start with |
|---|---|
| Just make it work locally | Recipe 1 and Recipe 2 |
| It works, now make it survive reality | Recipe 3, Recipe 4, and Recipe 5 |
| It touches my filesystem or production | Recipe 6 and Recipe 10, plus Recipe 13 if secrets flow |
| The model is small and wanders | Recipe 9, since it is near the default now |
| Long sessions blow the context | Recipe 15, plus Recipe 18 to keep what compaction evicts |
| It must stop at a spend line | Recipe 16 |
| It runs unattended but needs approvals | Recipe 17 |
| I want proof it all works | Recipe 12 |
