---
title: "src/mcp.rs"
---

This file connects you to MCP servers under the `mcp` feature, discovers their tools, and adapts them as loopctl tools. It is built on the `rmcp` library, hidden from your public client surface.

## Key items

Your `McpClient` offers `stdio(CommandSpec)`, `http_sse(endpoint)` plus `http_sse_with_client`, `in_process(server)`, and `from_service(...)`. Call `reconnect(&StreamRetryConfig)` when a link drops.

`CommandSpec { program, args, env, cwd }` uses struct-literal construction, with no builder to chase.

`McpToolProvider::connect(client, name_prefix)` snapshots the server's tools for you. Then use `register_into(&mut registry)`, `with_call_timeout` which defaults to 60s, `refresh()`, `tools()`, and `client()`.

`McpTool` is your adapted `Tool`: server schema verbatim, `is_concurrency_safe` false, and `is_read_only` taken from `readOnlyHint`.

`McpError` covers Handshake, Protocol, and EmptyToolError.

## Behavior notes

Your prefix namespaces names client-side as `prefix__tool`, and the un-prefixed name is what `tools/call` forwards.

Exceed the call timeout and you get a soft error naming the tool and its budget, so a wedged server costs you one result, not the loop.

Stdio children die with your client handle, since rmcp kills them with a 3s grace. In-process needs a tokio runtime and cannot reconnect.

Refresh does not retro-update tools you already registered, and duplicate names after prefixing collapse with the first kept.

Deep dive: [MCP](/integration/mcp/).
