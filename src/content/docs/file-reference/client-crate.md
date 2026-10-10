---
title: "`crates/client/` — the `loopctl-client` companion crate"
---


The family's shared daemon client, the seam of the k9s/kubectl split: one object-safe `LoopctlClient` interface consumed by every daemon-facing surface (the CLI's verbs, the TUI's attach/stream/approval, future third parties) — and implemented in-process by consumers that run without a daemon. `default = []`, no optional dependencies, Unix-only by design; publishes after loopctl.

**Key items**

- `DaemonClient` — the daemon-mode implementation: HTTP/1.1 REST + SSE over the per-user unix socket, `/v1`-versioned paths, JSON bodies, a deliberately minimal in-crate transport (connection-per-request, no TLS/HTTP/2).
- The versioned handshake (`GET /v1/hello` → `{family, protocol, floor}`) refusing a mismatched family member in **either** direction, naming both sides.
- The verb layer — loops `ls`/`get`, runs `start`/`get`/`stop`, gates `ls`/`approve`/`deny`, schedules `ls`/`run-now` — over one generic request path with typed `{status, code, message}` error envelopes.
- `subscribe(loop, since)` — the SSE observation surface: `id:` = resume cursor, `data:` = one trajectory-JSONL event (the ledger's interchange types reused, so wire and ledger cannot drift); HTTP 410 maps to the typed `CursorExpired`.
- `EventStream::from_pin_box` — the in-process subscription adapter (mode-unified surface).

**Behavior notes**

- All three response framings decode (Content-Length, chunked with a cancel-safe incremental decoder, close-delimited) under hard bounds: 64 KiB head, 4 MiB line, 10 MiB one-shot body, duplicate-`Content-Length` refused, the buffer compacted as frames are consumed.
- An absent socket is the typed `SocketAbsent` (the in-process degrade signal); autospawn is a bounded visible retry window ending in a typed `ConnectTimeout`; `LOOPCTL_NO_AUTOSPAWN=1` disables it; the default path follows `$XDG_RUNTIME_DIR/loopctl/loopctl.sock`.
- The mock-daemon contract suite (scripted local UDS server) pins the framings, the handshake floors, all eleven verb paths and bodies, and the SSE semantics — the crate is the protocol's client-side executable spec.

Deep dive: [loopctl-client](/integration/loopctl-client/)
