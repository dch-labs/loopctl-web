# `src/mcp.rs` — the MCP client side [feature: mcp]

Connect to MCP servers, discover their tools, adapt them as loopctl tools. Built on the `rmcp` library (hidden from the public client surface).

**Key items**

- `McpClient` — `stdio(CommandSpec)`, `http_sse(endpoint)` (+ `http_sse_with_client`), `in_process(server)`, `from_service(...)`; `reconnect(&StreamRetryConfig)`.
- `CommandSpec { program, args, env, cwd }` — struct-literal construction.
- `McpToolProvider::connect(client, name_prefix)` — snapshots the server's tools; `register_into(&registry)` (`&ToolRegistry` since 0.4.1); `with_call_timeout` (default 60s); `with_structured_policy(StructuredContentPolicy::Error | Lenient)` (0.4.1); `sync_into(&registry).await -> McpSyncReport` (0.4.1 — re-lists and mirrors the diff into a live registry); `refresh()`; `tools()`; `client()`.
- `McpSyncReport { added, removed, untouched }` — the sorted diff of one sync pass.
- `StructuredContentPolicy` — `Error` (default): invalid `structuredContent` becomes a soft tool error naming the violated schema keyword, raw payload preserved (2 KiB bound); `Lenient`: warn and pass through.
- `McpTool` — the adapted `Tool`: server schema verbatim, `is_concurrency_safe` false, `is_read_only` from `readOnlyHint`; `matches` compares the full observable contract (schema, description, read-only/destructive annotations, call timeout, structured policy).
- `McpError` — Handshake / Protocol / EmptyToolError.

**Behavior notes**

- The prefix namespaces names client-side (`prefix__tool`); the un-prefixed name is what `tools/call` forwards.
- Call timeout exceeded → **soft error** naming tool and budget — a wedged server costs one result, not the loop.
- Stdio children die with the client handle (rmcp kills, 3s grace); in-process needs a tokio runtime and can't reconnect.
- Refresh doesn't retro-update already-registered tools; duplicate names after prefixing collapse (first kept). `sync_into` is the retro-updating path for live registries.
- `sync_into` reconciles against the *registration baseline*, not the discovery snapshot: a refresh between setup and sync still sheds dropped tools, and a server-side change a refresh already pulled still re-registers. A dropped name is removed only while the target still holds this provider's registration (`registration_matches`) — a foreign tool that overwrote the shared name is left alone with a warning; an identical survivor keeps its handle untouched.
- A server-declared compilable `outputSchema` turns on per-call `structuredContent` validation: valid → pretty-printed JSON part + `DisplayHint::Json`; invalid → the policy's outcome. An uncompilable schema is omitted at discovery with a warning (tool stays listed, unvalidated); a declared-but-unused schema serves the text lane alone; schema-less tools keep the JSON-stringified note byte-for-byte.

Deep dive: [MCP](../06-integration/02-mcp.md).
