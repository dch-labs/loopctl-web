# `src/mcp/server.rs` — the MCP server side [feature: mcp]

Serve a `ToolRegistry` over MCP — your tools become usable by any MCP client. Exposes rmcp types deliberately (you're embedding a real server).

**Key items**

- `McpServerAdapter::new(registry, context, server_name, server_version)` — `Clone`. The registry is served **live** since 0.4.1: read on every `tools/list` and every call, with `registry()` handing out the shared `Arc<ToolRegistry>` so host mutations surface on the next request. (Still no `listChanged` notifications.)
- `serve_stdio(self)` — the canonical interactive transport; the returned `RunningService` has completed the handshake; `.waiting()` blocks until stdin closes; cancel via its token. Other transports: `adapter.serve(transport)` via rmcp's `ServiceExt`.

**Behavior notes**

- Advertises the tools capability only (no resources/prompts/sampling/logging; no `listChanged`).
- `list_tools` maps every schema through the validation layer (see [convert.rs](mcp-convert.md)) — invalid-schema tools are omitted with a warning, external `$ref`s are refused (never fetched).
- `call_tool`: unknown name → MCP `METHOD_NOT_FOUND` naming what *is* registered; everything the tool reports (soft error, hard failure, cancellation) is a tool-level `is_error` result.
- Cancellation drops in-flight tool futures — served tools must be cancellation-safe.
- **Structured emission (0.4.1):** a tool result carrying `DisplayHint::Json` has its parseable-object payload emitted as `structuredContent` beside the text lane (the payload's *last* text part is parsed, so a prose-plus-JSON multipart round-trips). A lying hint — prose, or a non-object — keeps the text lane with a warning.
- rmcp ≥ 3.4: the adapter follows rmcp's `ServerInfo` → `ServerConfig` rename — behavior is unchanged, but a downstream build naming the deprecated alias now fails under `-D warnings`.

Deep dive: [MCP](../06-integration/02-mcp.md).
