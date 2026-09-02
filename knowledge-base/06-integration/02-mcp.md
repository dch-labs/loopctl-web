# MCP — using foreign tools, and serving your own

**MCP (Model Context Protocol)** is an open standard for connecting AI applications to tools: an MCP **server** exposes tools; an MCP **client** discovers and calls them. loopctl speaks both directions. Feature: `mcp`. Sources: `src/mcp.rs`, `src/mcp/server.rs`, `src/mcp/convert.rs`.

- **As a client:** import tools from any MCP server (Claude Desktop, community servers, your own) into a `ToolRegistry` — they become ordinary loopctl tools.
- **As a server:** expose your `ToolRegistry` over MCP — any MCP client (including other agents) can use your tools.

---

## Client side — importing foreign tools

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
let mut registry = ToolRegistry::new();
provider.register_into(&mut registry);

let mut agent = BareLoop::new(my_client, registry, config);
```

The optional prefix namespaces imported tools (`fs__read_file`) so multiple servers can't collide. Discovery reads the server's `tools/list` (auto-paginated).

Behavior worth knowing:

- **Each `tools/call` has a timeout** — default 60s, tunable with `provider.with_call_timeout(...)`. A wedged server costs one soft error result naming the tool and budget, never a hung loop.
- **Imported tools declare `is_concurrency_safe: false`** — conservative: the protocol carries no concurrency hint. `readOnlyHint` maps to `is_read_only` when the server annotates it.
- **Errors:** protocol/transport failures become `ToolError::Execution` (soft, visible to the model); a server-reported tool error becomes a soft `is_error` result with the server's content.
- **Refresh:** `provider.refresh()` re-reads `tools/list` (servers change their tools). It does not retro-update tools already registered under stale names — you decide when to rebuild.
- **Reconnect:** `client.reconnect(&retry_config)` re-establishes a dropped stdio/HTTP connection with the same backoff strategy the stream handler uses. In-process clients can't reconnect (nothing to re-dial).
- **Stdio lifecycle:** the child process dies with the client handle (the transport kills it; force-kill after a 3s grace). Don't fight it with your own `kill_on_drop`.

### The bridging rules, precisely

Corners of the conversion that aren't visible from the happy path:

- **Annotation polarity is asymmetric.** An imported tool with no `annotations` block is treated as **destructive** (`destructiveHint` absent → assume destructive — the conservative reading), while `readOnlyHint` absent → not read-only. Outbound it's the mirror: a read-only tool sends `readOnlyHint: true` **and** `destructiveHint: false` (consistent pair); a non-read-only tool sends **no annotations at all**, leaving the client to apply its own defaults.
- **Arguments ride only when they're an object.** A call whose input isn't a JSON object goes to `tools/call` with no `arguments` field at all; on the serving side, a request with no arguments arrives as `Null` — not `{}` — and your tool sees what it sees.
- **Prefix collisions dedupe, keeping the first** — two server tools that produce the same `prefix__name` after namespacing collapse to one, with a warning. Register the colliding server under a different prefix instead.
- **The HTTP transport disables connection pooling** deliberately — a pooled streamable-HTTP connection hits ~40 ms TCP Delayed-ACK stalls; fresh connections are faster here. Stdio transport inherits the child's **stderr**, so server logs surface in yours.
- **Interactive MCP servers can wedge.** A server that keeps asking for elicited input (`input_required`) gets no answers from loopctl's fixed client handler, and surfaces as a rounds-exceeded error after the server's own cap — one soft error, not a hang.

## Server side — serving your tools

```rust
use loopctl::mcp::McpServerAdapter;

let adapter = McpServerAdapter::new(
    registry,                          // your ToolRegistry (moved in — snapshot semantics)
    ToolContext::default(),
    "my-agent-tools".into(),           // server name
    "1.0.0".into(),                    // server version
);

let service = adapter.serve_stdio()?;  // speak MCP on stdin/stdout
service.waiting().await;               // until stdin closes or you cancel
```

Any MCP client that spawns your process now sees your tools. Key behaviors:

- **Schemas are validated before being advertised** — with a real JSON Schema validator; **external `$ref`s are refused** (never fetched — a schema that would make your server do IO during `tools/list` is dropped instead), and non-object roots are skipped. A tool that can't be represented safely is omitted with a warning rather than breaking the listing.
- **Unknown tool calls** return a proper MCP `METHOD_NOT_FOUND` error naming the requested tool and what *is* registered.
- **Everything the tool reports is a tool-level result** — soft errors, hard failures, cancellations all come back as `is_error: true` content the remote model can read (protocol errors are reserved for routing problems).
- **Cancellation is honored mid-call:** a cancelled request drops the in-flight tool future — served tools must be cancellation-safe, same as engine-dispatched tools.
- **Snapshot semantics:** the adapter takes the registry as-is; serving a different tool set means building a new adapter. (No `listChanged` notifications.)

## The conversion layer, briefly

Foreign content blocks map onto loopctl types: text → text parts; images → base64 image sources; embedded resources → text notes (never silently dropped); `structuredContent` → carried as a JSON-stringified text part. Outbound, your `ToolSchema` becomes an MCP tool (the `tool` field maps to `name`), `is_read_only` becomes `readOnlyHint: true` **plus** `destructiveHint: false` (consistent with the spec's defaults), and `DisplayHint`/loopctl-specific details stay home.

---

## Gotchas

1. **MCP tool names have a convention** (`^[a-zA-Z0-9_-]{1,64}$`); strict clients reject others. loopctl imposes no rules — name your served tools sanely.
2. **In-process transport needs a running tokio runtime** (it spawns a task); a leaked in-process client leaks its server task.
3. **rmcp types on the server side:** the client adapters hide the underlying `rmcp` library entirely; the server adapter exposes it deliberately (`serve_stdio` returns rmcp's `RunningService`) — you're embedding a real MCP server.
4. **Two ready examples** ship in the repo: `examples/mcp-adapter.rs` (import + use) and `examples/mcp_server.rs` (serve a registry, including a deliberately failing tool).

---

## Related pages

- [Tools](../01-core-data/02-tools.md) — what becomes an MCP tool.
- [Examples tour](05-testing.md) — the MCP examples, runnable.
