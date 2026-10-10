---
title: "`examples/` and `tests/` — the runnable tour"
---


Two directories of executable knowledge: examples show *how*, integration tests show *what's guaranteed*.

## Examples (run with the listed features)

| Example | Features | Shows |
|---|---|---|
| `hello-cli` | testing | minimal single-turn agent + Ctrl-C wiring |
| `echo-tool-cli` | testing | the two-turn tool flow (call → result → final answer) |
| `derived-tool-cli` | derive, testing | `#[derive(Tool)]` side-by-side with the manual version |
| `repl-cli` | testing | interactive loop, fresh loop per line, abortable Ctrl-C task |
| `chat` | testing, providers | real-provider REPL: env-selected provider, observers, three FnTools, streaming vs not (`NO_STREAM=1`), token totals |
| `vector-index-demo` | vector_index | the embedding + nearest-neighbour layer with the hashing embedder |
| `vector-memory-cli` | vector_memory | the semantic memory store end-to-end |
| `file-memory-cli` | file_memory | `FileMemoryStore` — learned memory that survives a restart |
| `mcp-adapter` | mcp | import an in-process MCP server's tools, call them |
| `mcp-stdio-server` | mcp | a minimal stdio MCP server subprocess |
| `mcp_server` | mcp | serve a loopctl registry over MCP stdio (with a deliberately failing tool) |

The `crates/sqlite/` companion crate adds `sqlite-memory-cli` (`cargo run -p loopctl-sqlite --example sqlite-memory-cli`) — the same restart-survival demo over a WAL-mode database.

## Integration tests (each pins a subsystem contract)

`compaction_noop` / `compaction_pairs` (compaction honesty), `detection_false_positives` (the 11 patterns that must *not* flag), `fallback_switch`, `memoize_tool_call_id` (id stamping), `redacting_middleware`, `provider_error_path` / `provider_survival` (fail-fast vs retry), `structured_output`, `prompted_structured` (the schema-in-prompt fallback), `constrained_decode` (grammar, live), `mcp_tool_provider` / `mcp_transports`, `temp_dir_lifecycle`, `unwired_subsystems` (breaker gate, shield middleware), `derive_tool`, `trajectory_observer` (whole-run records), `vector_index`, `file_memory` (the persistent-store contracts), `census_pins` (cross-cutting behaviors the review census flagged as tested-nowhere), `examples_e2e`, `provider_e2e` (live, gated `LOOPCTL_E2E=1`). Since 0.4.0 the corpus also carries the harness suites: **cassette replay** (`cassettes/` — the wire oracle; hermetic, plus the `committed_cassettes_carry_no_secrets` meta-test) and **golden request bytes** (`golden_requests` — the engine-construction oracle) — and the wave of subsystem suites the release added: `gate_decisions`, `external_approver`, `budget_gate`, `search_tools`, `shell_tools`, `fs_tools`, `qa_summarizer` / `structured_summarizer` / `fallback_compactor` (+ their metrics binaries), `search_memories_tool`, `embeddings_wire`, `client` (the loopctl-client mock-daemon suite), and the make-gated minimal-graph probes. The `loopctl-sqlite` crate carries its own suite (restart survival, ranking parity, WAL multi-writer); `loopctl-hnsw` and `loopctl-vector` likewise.

## Makefile targets

`make ci` (everything), `make test` (default + all-features + doctests), `make lint` (format), `make examples`, `make e2e` (live provider suites).

**Behavior notes**

- Examples double as documentation — start at `hello-cli`, end at `chat`.
- Tests are behavior-sentence-named; grep them for the guarantee you need.

Deep dives: [testing](/integration/testing/) · [recipes](/cookbook/recipes/).
