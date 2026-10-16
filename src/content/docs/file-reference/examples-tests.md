---
title: "examples and tests"
---

These two directories are executable knowledge. The examples show you how, and the integration tests show you what is guaranteed.

## Examples, run with the listed features

| Example | Features | What it shows |
|---|---|---|
| `hello-cli` | testing | A minimal single-turn agent plus the Ctrl-C wiring |
| `echo-tool-cli` | testing | The two-turn tool flow of call, result, and final answer |
| `derived-tool-cli` | derive, testing | `#[derive(Tool)]` side-by-side with the manual version |
| `repl-cli` | testing | An interactive loop with a fresh loop per line and an abortable Ctrl-C task |
| `chat` | testing, providers | A real-provider REPL with an env-selected provider, observers, three FnTools, streaming versus not through `NO_STREAM=1`, and token totals |
| `vector-index-demo` | vector_index | The embedding and nearest-neighbour layer with the hashing embedder |
| `vector-memory-cli` | vector_memory | The semantic memory store end-to-end |
| `file-memory-cli` | file_memory | `FileMemoryStore`, which is learned memory that survives a restart |
| `mcp-adapter` | mcp | Importing an in-process MCP server's tools and calling them |
| `mcp-stdio-server` | mcp | A minimal stdio MCP server subprocess |
| `mcp_server` | mcp | Serving a loopctl registry over MCP stdio, with a deliberately failing tool |

The `crates/sqlite/` companion crate adds `sqlite-memory-cli`, which you run with `cargo run -p loopctl-sqlite --example sqlite-memory-cli`. It is the same restart-survival demo over a WAL-mode database.

## Integration tests, each pinning a subsystem contract

Compaction honesty is pinned by `compaction_noop` and `compaction_pairs`, and false positives by `detection_false_positives`, which holds the 11 patterns that must not flag.

`fallback_switch` covers routing, and `memoize_tool_call_id` covers id stamping. `redacting_middleware` covers scrubbing, and `provider_error_path` and `provider_survival` cover fail-fast versus retry.

Structured answers are pinned by `structured_output` and by `prompted_structured`, which is the schema-in-prompt fallback, and `constrained_decode` covers grammar against a live server.

MCP is covered by `mcp_tool_provider` and `mcp_transports`, and lifecycle by `temp_dir_lifecycle`. `unwired_subsystems` covers the breaker gate and shield middleware, and `derive_tool` covers the macro.

`trajectory_observer` pins whole-run records, and `vector_index` and `file_memory` pin the persistent-store contracts.

`census_pins` holds the cross-cutting behaviors that the review census flagged as tested nowhere. `examples_e2e` and `provider_e2e` are live and gated behind `LOOPCTL_E2E=1`.

Since 0.4.0 the corpus also carries the harness suites. Cassette replay lives in `cassettes/` and is your hermetic wire oracle, plus the `committed_cassettes_carry_no_secrets` meta-test. Golden request bytes live in `golden_requests` and are your engine-construction oracle.

The release also added a wave of subsystem suites. These are `gate_decisions`, `external_approver`, `budget_gate`, `search_tools`, `shell_tools`, and `fs_tools`.

The compaction trio `qa_summarizer`, `structured_summarizer`, and `fallback_compactor` arrived with their metrics binaries, and so did `search_memories_tool` and `embeddings_wire`.

`client` is the loopctl-client mock-daemon suite, and the minimal-graph probes are make-gated.

The `loopctl-sqlite` crate carries its own suite for restart survival, ranking parity, and WAL multi-writer behavior, and `loopctl-hnsw` and `loopctl-vector` likewise.

## Makefile targets

Run `make ci` for everything, `make test` for default plus all-features plus doctests, `make lint` for format, `make examples` for the examples, and `make e2e` for the live provider suites.

## Behavior notes

The examples double as documentation, so start at `hello-cli` and end at `chat`.

Test names are behavior sentences, so grep them for the guarantee you need.

For the deep dives, see [testing](/integration/testing/) and [recipes](/cookbook/recipes/).
