---
title: "src/mcp.rs"
---

This file connects you to MCP servers under the `mcp` feature, discovers their tools, and adapts them as loopctl tools. It is built on the `rmcp` library, hidden from your public client surface.

## Key items

Your `McpClient` offers `stdio(CommandSpec)`, `http_sse(endpoint)` plus `http_sse_with_client`, `in_process(server)`, and `from_service(...)`. Call `reconnect(&StreamRetryConfig)` when a link drops.

`CommandSpec { program, args, env, cwd }` uses struct-literal construction, with no builder to chase.

`McpToolProvider::connect(client, name_prefix)` snapshots the server's tools for you. Then use `register_into(&registry)`, which takes `&ToolRegistry` since 0.4.1, plus `with_call_timeout` which defaults to 60s, `refresh()`, `tools()`, and `client()`.

Since 0.4.1 you also get `sync_into(&registry).await`, which re-lists the server and mirrors the diff into a live registry. It returns an `McpSyncReport { added, removed, untouched }` with the sorted diff. Call `with_structured_policy(StructuredContentPolicy::Error | Lenient)` to set the structured-content policy, where `Error` is the default.

`McpTool::matches` compares the full observable contract for you: schema, description, the read-only and destructive annotations, call timeout, and the structured policy.

`McpTool` is your adapted `Tool`: server schema verbatim, `is_concurrency_safe` false, and `is_read_only` taken from `readOnlyHint`.

`McpError` covers Handshake, Protocol, and EmptyToolError.

## Behavior notes

Your prefix namespaces names client-side as `prefix__tool`, and the un-prefixed name is what `tools/call` forwards.

Exceed the call timeout and you get a soft error naming the tool and its budget, so a wedged server costs you one result, not the loop.

Stdio children die with your client handle, since rmcp kills them with a 3s grace. In-process needs a tokio runtime and cannot reconnect.

Refresh does not retro-update tools you already registered, and duplicate names after prefixing collapse with the first kept. `sync_into` is the retro-updating path for your live registries.

`sync_into` reconciles against the registration baseline, not the discovery snapshot. A refresh between setup and sync still sheds dropped tools, and a server-side change a refresh already pulled still re-registers.

A dropped name is removed only while the target still holds this provider's registration, through `registration_matches`. A foreign tool that overwrote the shared name is left alone with a warning.

A server-declared compilable `outputSchema` turns on per-call `structuredContent` validation. A valid payload rides as a pretty-printed JSON part with `DisplayHint::Json`, and an invalid one hits the policy.

Under `Error` you get a soft error naming the violated keyword, and under `Lenient` a warning and passthrough. An uncompilable schema is omitted at discovery with a warning, so the tool stays listed but unvalidated. Schema-less tools keep the JSON-stringified note byte-for-byte.

Deep dive: [MCP](/integration/mcp/).
