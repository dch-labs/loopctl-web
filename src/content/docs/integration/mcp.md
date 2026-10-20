---
title: "MCP: using foreign tools, and serving your own"
sidebar:
  order: 2
---

MCP, the Model Context Protocol, is an open standard for connecting AI applications to tools. An MCP server exposes tools, and an MCP client discovers and calls them. loopctl speaks both directions.

The feature is `mcp`, and the sources are `src/mcp.rs`, `src/mcp/server.rs`, and `src/mcp/convert.rs`.

- **As a client**, you import tools from any MCP server, such as Claude Desktop, community
  servers, or your own, into a `ToolRegistry`, and they become ordinary loopctl tools.
- **As a server**, you expose your `ToolRegistry` over MCP, so any MCP client, including
  another agent, can use your tools.

## Client side: importing foreign tools

```rust
use loopctl::mcp::{McpClient, McpToolProvider, CommandSpec};

// 1. Connect — three transports:
let client = McpClient::stdio(CommandSpec {              // spawn a subprocess
    program: "npx".into(),
    args: vec!["-y".into(), "@modelcontextprotocol/server-filesystem".into(), "/tmp".into()),
    ..Default::default()
})?;
// let client = McpClient::http_sse("https://mcp.example.com/mcp")?;   // remote server
// let client = McpClient::in_process(my_server)?;                     // no subprocess at all

// 2. Discover its tools:
let mut provider = McpToolProvider::connect(client, Some("fs".into()))?;

// 3. Register them like any other tools:
let registry = ToolRegistry::new();
provider.register_into(&registry);          // &ToolRegistry since 0.4.1
// or, when the registry is live: provider.sync_into(&registry).await?

let mut agent = BareLoop::new(my_client, registry, config);
```

The optional prefix namespaces your imported tools as `fs__read_file`, so multiple servers cannot collide. Discovery reads the server's `tools/list` and is auto-paginated.

Seven behaviors are worth knowing:

- **Every `tools/call` has a timeout.** The default is 60s, and you tune it with
  `provider.with_call_timeout(...)`. A wedged server costs you one soft error result that
  names the tool and the budget, and it never hangs your loop.

- **Imported tools declare `is_concurrency_safe: false`.** That is the conservative
  reading, because the protocol carries no concurrency hint. A `readOnlyHint` maps to
  `is_read_only` when the server annotates it.

- **Protocol and transport failures become `ToolError::Execution`.** That is soft and
  visible to your model. A server-reported tool error becomes a soft `is_error` result
  carrying the server's content.

- **`provider.refresh()` re-reads `tools/list`,** because servers change their tools. It
  does not retro-update tools you already registered under stale names, so you decide when
  to rebuild.

- **Live registries sync since 0.4.1.** Call `provider.sync_into(&registry).await` to
  re-list the server and mirror the diff into a live registry. Added names register.
  Dropped names are removed while the target still holds this provider's registration.

  Identical survivors keep their handles untouched, and a survivor whose contract moved is
  refreshed in place. You get back an `McpSyncReport { added, removed, untouched }` with the
  sorted diff. A foreign tool that overwrote a shared name is left alone with a warning.

- **`client.reconnect(&retry_config)` re-establishes a dropped stdio or HTTP connection**
  with the same backoff strategy your stream handler uses. In-process clients cannot
  reconnect, since there is nothing to re-dial.

- **The child process dies with the client handle.** The transport kills it and
  force-kills after a 3s grace, so do not fight it with your own `kill_on_drop`.

### The bridging rules, precisely

Five corners of the conversion are not visible from the happy path:

- **Annotation polarity is asymmetric.** An imported tool with no `annotations` block is
  treated as destructive, because an absent `destructiveHint` means assume destructive. An
  absent `readOnlyHint` means not read-only. Outbound the picture mirrors. A read-only
  tool sends `readOnlyHint: true` and `destructiveHint: false` as a consistent pair.

  A non-read-only tool sends no annotations at all, which leaves your client to apply its own defaults.

- **Arguments ride only when they are an object.** A call whose input is not a JSON object
  goes to `tools/call` with no `arguments` field at all. On the serving side, a request
  with no arguments arrives as `Null` rather than `{}`, and your tool sees what it sees.

- **Prefix collisions dedupe by keeping the first.** Two server tools that produce the
  same `prefix__name` after namespacing collapse to one, with a warning. Register the
  colliding server under a different prefix instead.

- **The HTTP transport disables connection pooling deliberately.** A pooled
  streamable-HTTP connection hits roughly 40 ms TCP Delayed-ACK stalls, and fresh
  connections are faster here. Your stdio transport inherits the child's stderr, so server
  logs surface in yours.

- **An interactive MCP server can wedge.** A server that keeps asking for elicited input,
  meaning `input_required`, gets no answers from loopctl's fixed client handler.

  It then surfaces as a rounds-exceeded error after the server's own cap, which is one soft error rather than a hang.

## Server side: serving your tools

```rust
use loopctl::mcp::McpServerAdapter;

let adapter = McpServerAdapter::new(
    registry,                          // your ToolRegistry (served live since 0.4.1)
    ToolContext::default(),
    "my-agent-tools".into(),           // server name
    "1.0.0".into(),                    // server version
);

let service = adapter.serve_stdio()?;  // speak MCP on stdin/stdout
service.waiting().await;               // until stdin closes or you cancel
```

Any MCP client that spawns your process now sees your tools. Five behaviors matter:

- **Schemas are validated before they are advertised,** using a real JSON Schema
  validator. External `$ref`s are refused and never fetched, so a schema that would make
  your server do IO during `tools/list` is dropped instead, and non-object roots are
  skipped.
- A tool that cannot be represented safely is omitted with a warning rather than breaking
  the listing.

- **An unknown tool call returns a proper MCP `METHOD_NOT_FOUND` error** that names the
  requested tool and what is registered.

- **Everything your tool reports is a tool-level result.** Soft errors, hard failures, and
  cancellations all come back as `is_error: true` content the remote model can read.

  Protocol errors are reserved for routing problems.

- **Cancellation is honored mid-call.** A cancelled request drops the in-flight tool
  future, so a served tool must be cancellation-safe, exactly like an engine-dispatched
  tool.

- Your registry is served live since 0.4.1. The adapter reads it on every `tools/list`
  and every call, and `adapter.registry()` hands you the shared handle, so mutations you
  make surface on the next request.

  You no longer rebuild the adapter to serve a changing tool set. There are still no
  `listChanged` notifications, so clients re-list.

## Structured content, both lanes (0.4.1)

The protocol lets a server attach a `structuredContent` JSON object beside the text of a
result, validated against the tool's declared `outputSchema`. loopctl now speaks both
sides.

On the client side, a tool whose server declared a compilable `outputSchema` has every
call's `structuredContent` validated:

| Outcome | What you get |
|---|---|
| valid payload | a pretty-printed JSON part beside the text lane, with the whole output marked `DisplayHint::Json` |
| invalid payload | a soft tool error naming the violated schema keyword, and the raw payload preserved under a 2 KiB bound, so your model adapts and the loop continues |
| `Lenient` policy | a warning and passthrough, for hosts that trust their servers |
| schema declared, no structured content | the text lane alone |
| uncompilable `outputSchema` | omitted at discovery with a warning, and the tool stays listed but unvalidated |

The default policy is `StructuredContentPolicy::Error`. Switch with
`provider.with_structured_policy(StructuredContentPolicy::Lenient)`. The policy is compared
on sync, so a change you make reaches already-registered tools through the next
`sync_into`.

On the server side, a host tool whose result carries `DisplayHint::Json` has its
parseable-object payload emitted as `structuredContent` beside the text lane. The emission
parses the payload's last text part, so a prose-plus-JSON multipart round-trips its
structured lane.

A hint that lies, meaning prose or a non-object, keeps the text lane with a warning.

## The conversion layer, briefly

Foreign content blocks map onto loopctl types. Text becomes text parts, images become base64 image sources, and embedded resources become text notes rather than being silently dropped.

A `structuredContent` becomes a validated JSON part when the tool declares a compilable `outputSchema`. A schema-less tool keeps the JSON-stringified text part byte-for-byte.

Outbound, your `ToolSchema` becomes an MCP tool, and the `tool` field maps to `name`. An `is_read_only` becomes `readOnlyHint: true` plus `destructiveHint: false`, which is consistent with the spec's defaults. Your `DisplayHint` and other loopctl-specific details stay home.

## Gotchas

1. MCP tool names follow a convention, `^[a-zA-Z0-9_-]{1,64}$`, and strict clients reject
  others. loopctl imposes no rules, so name your served tools sanely.

2. The in-process transport needs a running tokio runtime, because it spawns a task. A
  leaked in-process client leaks its server task.

3. The client adapters hide the underlying `rmcp` library entirely, but the server adapter
  exposes it deliberately, since `serve_stdio` returns rmcp's `RunningService`. You are
  embedding a real MCP server.

4. Two ready examples ship in the repo: `examples/mcp-adapter.rs` imports and uses tools,
  and `examples/mcp_server.rs` serves a registry, including a deliberately failing tool.

## Related pages

- [Tools](/core-data/tools/) covers what becomes an MCP tool.
- [Examples tour](/integration/testing/) makes the MCP examples runnable.
