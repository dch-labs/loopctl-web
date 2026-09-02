# `examples/` and `tests/` — the runnable tour

Two directories of executable knowledge: examples show *how*, integration tests show *what's guaranteed*.

## Examples (run with the listed features)

| Example | Features | Shows |
|---|---|---|
| `hello-cli` | testing | minimal single-turn agent + Ctrl-C wiring |
| `echo-tool-cli` | testing | the two-turn tool flow (call → result → final answer) |
| `derived-tool-cli` | derive, testing | `#[derive(Tool)]` side-by-side with the manual version |
| `repl-cli` | testing | interactive loop, fresh loop per line, abortable Ctrl-C task |
| `chat` | testing, providers | real-provider REPL: env-selected provider, observers, three FnTools, streaming vs not (`NO_STREAM=1`), token totals |
| `mcp-adapter` | mcp | import an in-process MCP server's tools, call them |
| `mcp-stdio-server` | mcp | a minimal stdio MCP server subprocess |
| `mcp_server` | mcp | serve a loopctl registry over MCP stdio (with a deliberately failing tool) |

## Integration tests (each pins a subsystem contract)

`compaction_noop` / `compaction_pairs` (compaction honesty), `detection_false_positives` (the 11 patterns that must *not* flag), `fallback_switch`, `memoize_tool_call_id` (id stamping), `redacting_middleware`, `provider_error_path` / `provider_survival` (fail-fast vs retry), `structured_output`, `constrained_decode` (grammar, live), `mcp_tool_provider` / `mcp_transports`, `temp_dir_lifecycle`, `unwired_subsystems` (breaker gate, shield middleware), `derive_tool`, `examples_e2e`, `provider_e2e` (live, gated `LOOPCTL_E2E=1`).

## Makefile targets

`make ci` (everything), `make test` (default + all-features + doctests), `make lint` (format), `make examples`, `make e2e` (live provider suites).

**Behavior notes**

- Examples double as documentation — start at `hello-cli`, end at `chat`.
- Tests are behavior-sentence-named; grep them for the guarantee you need.

Deep dives: [testing](../06-integration/05-testing.md) · [recipes](../08-cookbook/02-recipes.md).
