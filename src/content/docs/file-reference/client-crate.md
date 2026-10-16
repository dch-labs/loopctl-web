---
title: "crates/client/"
---

`loopctl-client` is the crate that talks to the loopctl daemon for you. The CLI verbs use it, and your TUI's attach, stream, and approval views use it too.

Third-party tools can use it as well, because it exposes one object-safe `LoopctlClient` interface.

Code that runs without a daemon implements that interface in-process instead of opening a socket for you.

This is the seam that separates your CLI from the daemon, the same split k9s makes with kubectl.

The crate has `default = []`, carries no optional dependencies, and is Unix-only by design. It publishes after `loopctl`.

## `DaemonClient`

`DaemonClient` is the daemon-mode implementation. It speaks HTTP/1.1 REST plus SSE over your per-user unix socket.

Paths are versioned under `/v1` and bodies are JSON. The transport lives inside the crate and is deliberately minimal, so you get one connection per request, no TLS, and no HTTP/2.

### The handshake

A session starts with `GET /v1/hello`, which returns `{family, protocol, floor}`. If the two sides do not match, the client refuses the connection in either direction. The error names both sides.

### Verbs

| Area | Calls |
| --- | --- |
| Loops | `ls`, `get` |
| Runs | `start`, `get`, `stop` |
| Gates | `ls`, `approve`, `deny` |
| Schedules | `ls`, `run-now` |

Every verb goes through one generic request path. A failure comes back as a typed `{status, code, message}` error envelope.

### Streaming

Call `subscribe(loop, since)` to open your SSE observation surface.

Each event carries a resume cursor in `id:` and one trajectory-JSONL event in `data:`. These are the ledger's interchange types reused, so your wire format and the ledger cannot drift apart.

An expired cursor arrives as HTTP 410 and maps to the typed `CursorExpired`.

`EventStream::from_pin_box` adapts an in-process subscription to the same mode-unified surface, so callers never need to know which mode they are in.

## Response framing

Three response framings decode: Content-Length, chunked, and close-delimited. The chunked path uses a cancel-safe incremental decoder. All three run under hard bounds:

| Limit | Value |
| --- | --- |
| Head | 64 KiB |
| Line | 4 MiB |
| One-shot body | 10 MiB |

A duplicate `Content-Length` is refused. The buffer is compacted as frames are consumed, so a long stream does not grow memory.

## When the daemon is not there

An absent socket is the typed `SocketAbsent`. That is also the in-process degrade signal. Autospawn is a bounded, visible retry window that ends in a typed `ConnectTimeout`. Set `LOOPCTL_NO_AUTOSPAWN=1` to disable it. The default path follows `$XDG_RUNTIME_DIR/loopctl/loopctl.sock`.

## Tests

A mock-daemon contract suite runs against a scripted local UDS server. It pins the framings, the handshake floors, all eleven verb paths and bodies, and the SSE semantics. The crate is the protocol's client-side executable spec.

Deep dive: [loopctl-client](/integration/loopctl-client/)
