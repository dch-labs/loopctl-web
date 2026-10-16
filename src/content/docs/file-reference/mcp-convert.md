---
title: "src/mcp/convert.rs"
---

This file holds the mapping between loopctl types and MCP wire types, in both directions, behind the `mcp` feature.

It also holds the safety validation on the way out.

## Key items

Inbound you get `bridge_content(&ContentBlock) -> ToolContentPart`, which covers text, images, and embedded resources as text notes, and nothing is silently dropped.

`bridge_result(...) -> ToolOutput` maps `isError` to `is_error` and carries `structuredContent` as a JSON-stringified text part, and an error with no content becomes `McpError::EmptyToolError`.

Outbound you get `tool_schema_to_mcp(schema, is_read_only) -> Option<McpTool>`, which does the `tool` to `name` rename.

Validation runs there, and your schema must compile under `jsonschema` with external references refused through `RefusingRetriever`. So there is no IO during your `tools/list`, and the root must be a typed object.

Anything else gives you `None` plus a warning, and the tool is omitted.

`dispatch_result_to_call_tool(...)` turns every tool outcome into a tool-level result, hard failures included.

`not_found_error(requested, available)` builds the `METHOD_NOT_FOUND` payload you send back.

## Behavior notes

Read-only forwarding is consistent with the spec's defaults, so your tool gets `readOnlyHint: true` plus `destructiveHint: false`, and a non-read-only tool gets no annotations at all.

The validation is the security boundary for the schemas you serve. A `$ref` pointing at a URL or file path would make your server do IO mid-listing, so it is refused instead.

MCP's name convention, `^[a-zA-Z0-9_-]{1,64}$`, is the embedding's responsibility, since loopctl imposes no rules on you.

For the deep dive, see [MCP](/integration/mcp/).
