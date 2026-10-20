---
title: "src/mcp/server.rs"
---

This file serves your `ToolRegistry` over MCP under the `mcp` feature, so your tools become usable by any MCP client. It exposes rmcp types deliberately, because you are embedding a real server.

## Key items

`McpServerAdapter::new(registry, context, server_name, server_version)` is `Clone`. Your registry is served live since 0.4.1. The adapter reads it on every `tools/list` and every call, and `registry()` hands you the shared handle, so mutations you make surface on the next request.

You no longer rebuild the adapter to serve a changing tool set.

`serve_stdio(self)` is your canonical interactive transport. The returned `RunningService` has already completed the handshake, `.waiting()` blocks until stdin closes, and you cancel through its token.

Other transports go through `adapter.serve(transport)` using rmcp's `ServiceExt`.

## Behavior notes

Your server advertises the tools capability only: no resources, prompts, sampling, or logging, and no `listChanged`.

`list_tools` maps every schema through the validation layer, see [convert.rs](/file-reference/mcp-convert/). Invalid-schema tools are omitted with a warning, and external `$ref`s are refused, never fetched.

In `call_tool`, an unknown name returns MCP `METHOD_NOT_FOUND` naming what is registered. Everything else your tool reports, soft error, hard failure, or cancellation, arrives as a tool-level `is_error` result.

Cancellation drops in-flight tool futures, so your served tools must be cancellation-safe.

Structured emission joined in 0.4.1. A tool result you mark `DisplayHint::Json` has its parseable-object payload emitted as `structuredContent` beside the text lane. The emission parses the payload's last text part, so a prose-plus-JSON multipart round-trips.

A hint that lies, meaning prose or a non-object, keeps the text lane with a warning.

On rmcp ≥ 3.4 the adapter follows rmcp's `ServerInfo` to `ServerConfig` rename. Behavior is unchanged, but a downstream build naming the deprecated alias now fails under `-D warnings`.

Deep dive: [MCP](/integration/mcp/).
