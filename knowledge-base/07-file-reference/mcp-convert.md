# `src/mcp/convert.rs` — the MCP conversion layer [feature: mcp]

The mapping between loopctl types and MCP wire types, in both directions, with the safety validation on the way out.

**Key items**

- Inbound: `bridge_content(&ContentBlock) -> ToolContentPart` (text, images, embedded resources as text notes — nothing silently dropped); `bridge_result(...) -> ToolOutput` (`isError` → `is_error`; `structuredContent` carried as a JSON-stringified text part; error with no content → `McpError::EmptyToolError`).
- Outbound: `tool_schema_to_mcp(schema, is_read_only) -> Option<McpTool>` — the `tool`→`name` rename; **validation**: schema must compile under `jsonschema` with external references refused (`RefusingRetriever` — no IO during `tools/list`), and the root must be a typed object; anything else → `None` + warning (tool omitted).
- `dispatch_result_to_call_tool(...)` — every tool outcome becomes a tool-level result (hard failures included).
- `not_found_error(requested, available)` — the `METHOD_NOT_FOUND` payload.

**Behavior notes**

- Read-only forwarding is consistent with the spec's defaults: `readOnlyHint: true` **plus** `destructiveHint: false`; non-read-only gets no annotations at all.
- The validation is the security boundary for served schemas — a `$ref` pointing at a URL or file path would make your server do IO mid-listing; it is refused instead.
- MCP's name convention (`^[a-zA-Z0-9_-]{1,64}$`) is the embedding's responsibility — loopctl imposes no rules.

Deep dive: [MCP](../06-integration/02-mcp.md).
