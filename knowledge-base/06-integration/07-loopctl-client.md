# `loopctl-client` — the family's shared daemon client

The fifth companion crate (`crates/client/`, `loopctl-client`): one object-safe client interface for everything daemon-facing, so no family binary smears the protocol across its internals. The CLI's daemon-facing verbs, a TUI's attach/stream/approval surfaces, and future third-party clients all consume `DaemonClient`; **in-process consumers implement the same `LoopctlClient` interface** — a binary picks a mode without its call sites changing shape. `default = []`, no optional dependencies; publishes after loopctl, like the other companions. Unix-only by design (the transport *is* the unix socket).

---

## The wire dialect

HTTP/1.1 REST + SSE over a per-user unix socket (`$XDG_RUNTIME_DIR/loopctl/loopctl.sock`), `/v1`-versioned paths, JSON bodies — carried by a deliberately minimal in-crate transport (one socket, no TLS/HTTP/2/redirects, connection-per-request):

- **All three response framings** a compliant peer may use: declared `Content-Length`, chunked transfer coding (decoded incrementally through a cancel-safe state machine — every phase transition commits only after its bytes are consumed, so a dropped and recreated read resumes exactly where the last completed step left off), and close-delimiting.
- **Bounded against unbounded peers** — a 64 KiB head cap, a 4 MiB line cap, a 10 MiB one-shot body cap; conflicting duplicate `Content-Length` headers refused; the reader's buffer compacted as frames are consumed (a long subscription's memory tracks the unread window, not the stream's lifetime).
- **The versioned handshake** — `GET /v1/hello` → `{family, protocol, floor}`; construction refuses a family member outside the negotiated floor in *either* direction: a foreign family, a server below the client's floor, and a server whose own floor is above the client's version all reject **naming both sides** — an old or too-new peer is never silently absorbed.

## The verbs and the stream

| Surface | What it covers |
|---|---|
| Loops | `ls`, `get` |
| Runs | `start`, `get`, `stop` |
| Gates | `ls`, `approve`/`deny` (with reasons) |
| Schedules | `ls`, `run_now` |

The observation surface is **`subscribe(loop, since)`** — an SSE stream whose `id:` is the resume cursor and whose `data:` is one trajectory-JSONL event (the [event ledger](../04-extensions/06-event-hub.md) interchange types, reused from `loopctl::memory::trajectory` so the wire and the ledger cannot drift), with multi-`data:` joins, comment and `retry:` tolerance, and HTTP `410` mapped to the typed `CursorExpired` that states the relist contract. In-process consumers adapt their own event sources through `EventStream::from_pin_box` — the subscription surface is mode-unified in full.

Typed errors throughout: `{status, code, message}` envelopes, a typed `SocketAbsent` (the in-process degrade signal), `ConnectTimeout` under a bounded visible autospawn retry window, `LOOPCTL_NO_AUTOSPAWN=1` to disable spawning.

## The mode split, in one test

The crate's own suite pins the family's share-one-implementation claim in-repo: a second, in-process `LoopctlClient` implementation sits beside the daemon one behind the same `Box<dyn LoopctlClient>` — the one interface, both modes, against a scripted local UDS server that pins the three framings, the handshake floors, all eleven verb paths and bodies, and the SSE cursor semantics.

---

## Related pages

- [The event hub & ledger](../04-extensions/06-event-hub.md) — whose event types ride the stream.
- [Approvals](../03-safety/09-approvals.md) — the gate verbs' engine-side counterpart.
- [File reference: client crate](../07-file-reference/client-crate.md)
