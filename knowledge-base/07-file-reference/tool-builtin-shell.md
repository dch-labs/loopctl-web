# `src/tool/builtin/shell.rs` + `shell/` — the shell tool family [feature: shell_tools]

Command execution over a pluggable `ShellBackend`: the `Shell` tool (model-facing name `Shell`, not `bash` — gate policies stay OS-portable) and the `Jobs` tool over a host-created shared `JobStore`. `UnixShellBackend` (`#[cfg(unix)]`, in `shell/unix.rs`) ports the original mechanics; `shell/jobs.rs` holds the jobs machinery.

**Key items**

- The schema is neutral and grammar-server-safe: `command` required alone (no `anyOf`), `timeout_s` (default 120, clamp 600, zero rejected), `background`.
- `UnixShellBackend` — `bash -c` in its own process group with `kill_on_drop`; an RAII `ChildGuard` whose drop SIGKILLs the whole group on timeout (sub-shells and grandchildren die with the deadline; a reaped child disarms the guard so a detached helper survives); both streams read concurrently under a one-million-byte per-stream cap with drain-past-cap; `[exit {code}, {duration_ms}ms]` metadata, nonzero exits as error-text.
- Background jobs: `background: true` records a running entry in the shared `JobStore` (hosts hand one `Arc` to both tools — isolated slates, no process global) and detaches a bounded completion task — the one sanctioned `tokio::spawn`. `Jobs` lists, polls (`operation` ∈ `jobs`/`job_status`/`cleanup_jobs`), and clears; terminal jobs evict past twenty.
- Dynamic concurrency: the read-only-prefix allowlist (`cargo check` yes, `cargo checkout` no) with compound/redirection disqualifiers, the mutating-substring denylist, and expansion disqualifiers (any `$` or `{` — the shell expands `${IFS}`, `$'…'`, `{a,b}` into words the checked text never shows) drive `is_safe_for_concurrent_execution`.

**Behavior notes**

- A `ShellBackend::available` probe is consulted before a background spawn is acknowledged — a backend-less platform refuses synchronously with the same `Execution` text and records no job.
- Platforms without a backend answer an honest refusal while the schema stays present for gate rules; the `#[cfg(not(unix))]` placeholder is compile-checked by the CI windows cross-gate.
- Ships off by default — no preset registers it; explicit registration only.

Deep dive: [Tools](../01-core-data/02-tools.md) — the builtin families table.
