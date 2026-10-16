---
title: "What is loopctl?"
sidebar:
  order: 1
---

**loopctl** is a Rust toolbox for building **agents**. An agent is a program where an AI model does multi-step work for you by calling **tools**. A tool is a small function you write, like "read a file" or "run a search".

If you have used an AI assistant that looks things up, runs code, or edits files while it thinks, that is an agent.

`loopctl` gives you that engine, so you do not write the plumbing yourself.

## The problem loopctl solves

Imagine you want to build "an assistant that can read my files and answer questions."

You quickly discover the hard part is not the AI model. The hard part is everything around it, and you can see the list below in any agent you have ever written:

1. **The loop.** You send the user's question to the model. The model answers "I need to call the `read_file` tool first." You run the tool, send the result back, and the model replies again. Maybe it wants another tool. You repeat until it gives a final answer.
2. **Talking to the model provider.** Different providers (OpenAI, Anthropic, Google, and others) have different request formats, different streaming styles, different error messages.
3. **Failure handling.** Network hiccups. Rate limits telling you that you are sending too many requests. Tools that crash. The model asking for a tool that does not exist. The model getting stuck repeating the same call forever.
4. **The memory limit.** A model can only read so much text at once. That limit is the **context window**. Long conversations stop fitting, so you have to shrink them without losing the thread.
5. **Stopping.** The user presses Ctrl-C. You need to stop cleanly, right now, without corrupting anything.

Someone has to manage that loop, and that is the job `loopctl` does for you. You bring two things: **a connection to a model** and **your tools**. Your engine runs the rest.

## A tiny taste

This is a complete, working agent from `examples/hello-cli.rs` in the loopctl repository. You can run it without an API key, since it uses a fake model connection:

```rust
use loopctl::engine::BareLoop;
use loopctl::engine::core::Loop;
use loopctl::engine::RunConfig;
use loopctl::tool::ToolRegistry;
use loopctl::config::SessionConfig;
use loopctl::testing::MockApiClient;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    // 1. A connection to a model. Here: a fake one for testing.
    //    In real code this would be an OpenAI / Anthropic / Gemini client.
    let client = MockApiClient::new("hello-model").with_text_response("Hello, world!");

    // 2. Tools the model may use. This agent has none — that's allowed.
    let tools = ToolRegistry::new();

    // 3. Build the agent.
    let mut agent = BareLoop::new(Arc::new(client), tools, SessionConfig::default());

    // 4. Run it. One line does: send to model, read reply, run tools,
    //    send results back, repeat until the model gives a final answer.
    let result = agent
        .run("Say hello!", &RunConfig::default())
        .await
        .expect("run should succeed");

    println!("Output: {}", result.output.unwrap_or_default());
    println!("Took {} turns", result.turn_count());
}
```

The `run()` call returns a **`Run`** object: the final answer, how many turns it took, which tools were called, and how many tokens were used. If something goes wrong you get a typed error, never a panic.

## The five ideas behind loopctl

1. **You own the decisions, the framework owns the mechanics.** loopctl never picks a model for you, never invents tools, never sends your data anywhere you did not point it. Every default can be changed, and every optional part is off until you turn it on.
2. **Bring your own model.** loopctl ships ready-made clients for OpenAI, Anthropic, Google Gemini, AWS Bedrock, and OpenAI-compatible services such as Ollama, DeepSeek, Grok/xAI, Azure OpenAI, Moonshot, and Z.ai. You can also write your own by implementing one trait, `ApiClient`.
3. **Tools are plain Rust.** A tool is a struct with a name, a description, a JSON description of its input that you call its schema, and an async function. The framework turns tool results into model-readable messages for you.
4. **No panics. Ever.** The whole crate is compiled with `panic = "deny"`. Tools that panic are caught and reported as errors. A crashing tool becomes an error message the model can read and react to, and your program keeps running.
5. **Pay only for what you use.** The crate compiles with **zero default features**. Streaming, hooks, tool health, redaction, MCP support and each provider client is a Cargo feature you opt into. A minimal agent pulls in almost nothing.

## Words you will meet

The [Glossary](/glossary/) explains these in depth. Here is the minimum you need to read on:

| Word | Plain meaning |
|---|---|
| **LLM** | Large Language Model — the AI model itself (GPT, Claude, Gemini, ...). |
| **API** | Application Programming Interface — the network service you call to reach the model. |
| **Token** | A small chunk of text (roughly 4 characters). Providers bill and set limits in tokens. |
| **Context window** | The maximum number of tokens a model can read in one request. |
| **Turn** | One ask-reply round with the model. A run can have many turns. |
| **Run** | One complete `run("...")` call, from user input to final answer. |
| **Session** | One agent instance; holds settings and the history of all its runs. |
| **Tool** | A function the model can ask the program to run (read a file, search, ...). |
| **Streaming** | Getting the model's reply piece by piece as it is produced, instead of all at once. |
| **Compaction** | Shrinking a too-long conversation (usually into a summary) so it fits the context window. |

## Next

- [The big idea](/start-here/the-big-idea/): how the engine is built and why. Start here if you read one page.
- [Anatomy of a run](/start-here/anatomy-of-a-run/): one full run, step by step.
- [The codebase map](/start-here/codebase-map/): every folder and file, one line each.
- [Building your first tool](/core-data/tools/): hands on.
