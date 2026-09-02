---
title: "`src/mcp.rs` — the MCP client side [feature: mcp]"
---


Connect to MCP servers, discover their tools, adapt them as loopctl tools. Built on the `rmcp` library (hidden from the public client surface).

**Key items**

- `McpClient` — `stdio(CommandSpec)`, `http_sse(endpoint)` (+ `http_sse_with_client`), `in_process(server)`, `from_service(...)`; `reconnect(&StreamRetryConfig)`.
- `CommandSpec { program, args, env, cwd }` — struct-literal construction.
- `McpToolProvider::connect(client, name_prefix)` — snapshots the server's tools; `register_into(&mut registry)`; `with_call_timeout` (default 60s); `refresh()`; `tools()`; `client()`.
- `McpTool` — the adapted `Tool`: server schema verbatim, `is_concurrency_safe` false, `is_read_only` from `readOnlyHint`.
- `McpError` — Handshake / Protocol / EmptyToolError.

**Behavior notes**

- The prefix namespaces names client-side (`prefix__tool`); the un-prefixed name is what `tools/call` forwards.
- Call timeout exceeded → **soft error** naming tool and budget — a wedged server costs one result, not the loop.
- Stdio children die with the client handle (rmcp kills, 3s grace); in-process needs a tokio runtime and can't reconnect.
- Refresh doesn't retro-update already-registered tools; duplicate names after prefixing collapse (first kept).

Deep dive: [MCP](/integration/mcp/).
