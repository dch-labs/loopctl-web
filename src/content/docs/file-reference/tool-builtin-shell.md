---
title: "src/tool/builtin/shell.rs"
---

This file and its `shell/` directory give you command execution over a pluggable `ShellBackend`. You sit behind the `shell_tools` feature.

There are two tools. The `Shell` tool keeps the model-facing name `Shell` rather than `bash`, so your gate policies stay OS-portable. The `Jobs` tool works over a host-created shared `JobStore`.

`UnixShellBackend` lives in `shell/unix.rs` behind `#[cfg(unix)]` and ports the original mechanics, and `shell/jobs.rs` holds the jobs machinery.

## Key items

The schema is neutral and grammar-server-safe. `command` is required alone, with no `anyOf`, and you also get `timeout_s`, which defaults to 120, clamps at 600, and rejects zero, plus `background`.

`UnixShellBackend` runs `bash -c` in its own process group with `kill_on_drop`.

An RAII `ChildGuard` SIGKILLs the whole group on drop at a timeout, so your sub-shells and grandchildren die with the deadline. A reaped child disarms the guard, so a detached helper survives.

Both streams are read concurrently under a one-million-byte per-stream cap with drain-past-cap, and you get `[exit {code}, {duration_ms}ms]` metadata, where nonzero exits arrive as error-text.

For background jobs, `background: true` records a running entry in the shared `JobStore` and detaches a bounded completion task, which is the one sanctioned `tokio::spawn`. Your host hands one `Arc` to both tools, so you get isolated slates rather than a process global.

The `Jobs` tool lists, polls, and clears, where `operation` is `jobs`, `job_status`, or `cleanup_jobs`. Terminal jobs evict past twenty.

Concurrency is decided dynamically by `is_safe_for_concurrent_execution`. A read-only-prefix allowlist approves `cargo check` and refuses `cargo checkout`, and compound or redirection forms are disqualified.

Retention classification joined in 0.4.1. Sequenced and piped read-only compounds, such as `cd /repo && grep -n needle file`, stamp `Requery`, decided segment-wise. A `cd` prefix is admitted, and every segment must pass the allowlist.

Any mutating segment, redirection, or control separator, including a newline, keeps the whole receipt `Durable`. A failed read-only compound stays unclassed.

A missing `command` rejects with the shared teaching shape since 0.4.1:

```text
Missing command (got top-level keys: no keys; expected key 'command')
```

A denylist of mutating substrings follows, and expansion disqualifiers reject any `$` or `{`, because your shell expands `${IFS}`, `$'…'`, and `{a,b}` into words the checked text never shows.

## Behavior notes

A `ShellBackend::available` probe is consulted before a background spawn is acknowledged. On a backend-less platform you are refused synchronously with the same `Execution` text, and no job is recorded.

A platform without a backend answers you with an honest refusal while the schema stays present for your gate rules. The `#[cfg(not(unix))]` placeholder is compile-checked by the CI windows cross-gate.

This family ships off by default. No preset registers it, so registration is explicit only.

For the deep dive, see the builtin families table in [Tools](/core-data/tools/).
