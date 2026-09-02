# `src/mcp/server.rs` — the MCP server side [feature: mcp]

Serve a `ToolRegistry` over MCP — your tools become usable by any MCP client. Exposes rmcp types deliberately (you're embedding a real server).

**Key items**

- `McpServerAdapter::new(registry, context, server_name, server_version)` — `Clone`; snapshot semantics (rebuild for a different tool set).
- `serve_stdio(self)` — the canonical interactive transport; the returned `RunningService` has completed the handshake; `.waiting()` blocks until stdin closes; cancel via its token. Other transports: `adapter.serve(transport)` via rmcp's `ServiceExt`.

**Behavior notes**

- Advertises the tools capability only (no resources/prompts/sampling/logging; no `listChanged`).
- `list_tools` maps every schema through the validation layer (see [convert.rs](mcp-convert.md)) — invalid-schema tools are omitted with a warning, external `$ref`s are refused (never fetched).
- `call_tool`: unknown name → MCP `METHOD_NOT_FOUND` naming what *is* registered; everything the tool reports (soft error, hard failure, cancellation) is a tool-level `is_error` result.
- Cancellation drops in-flight tool futures — served tools must be cancellation-safe.

Deep dive: [MCP](../06-integration/02-mcp.md).
