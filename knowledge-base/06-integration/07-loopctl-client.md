# `loopctl-client` — the family's shared daemon client

The fifth companion crate (`crates/client/`, `loopctl-client`): one object-safe client interface for everything daemon-facing, so no family binary smears the protocol across its internals. The CLI's daemon-facing verbs, a TUI's attach/stream/approval surfaces, and future third-party clients all consume `DaemonClient`; **in-process consumers implement the same `LoopctlClient` interface** — a binary picks a mode without its call sites changing shape. `default = []`, with the one optional dependency set behind the `tls` feature; publishes after loopctl, like the other companions. Since 0.6.0 it builds on every platform: the socket endpoint stays Unix-only while TCP, TLS, the verbs, and the event stream run anywhere.

---

## The wire dialect

HTTP/1.1 REST + SSE over the per-user unix socket (`$XDG_RUNTIME_DIR/loopctl/loopctl.sock`), `/v1`-versioned paths, JSON bodies — carried on the socket (and TCP) by a deliberately minimal in-crate transport, one connection per request with no HTTP/2 or redirects; TLS is the remote endpoints' own carrier behind the `tls` feature (below):

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

## Remote endpoints, TLS, and deadlines (0.6.0)

`ConnectOptions` carries an `Endpoint`: the socket as before, `tcp(host, port, token)` for trusted networks (the token crosses in the clear), `tls(...)` behind the new `tls` feature (verifying against a CA you name or the WebPKI roots, fail-closed), and `mtls(...)` adding a client-identity PEM for daemons that authenticate clients. Remote endpoints send a bearer token on every request, and a 401/403 answers as the typed `ClientError::Unauthorized`. Tokens never render through `Debug`, and a token or host carrying CR, LF, or NUL refuses before the wire.

Every exchange answers within one deadline (`with_deadline`, default 30 s) covering the handshake, each verb, and a subscription's establishing head; the spawn window retries transient handshake failures and spends one aggregate deadline. The wire contract also tightened: interim `1xx` heads are skipped, trailer sections past 64 lines refuse, non-`text/event-stream` subscription answers refuse, undelimited event frames refuse at 4 MiB, non-increasing cursors refuse the feed, 204 answers bodyless, and error bodies drain under 64 KiB. Autospawn stays a socket behavior. Breaking: `socket_path` became `endpoint`, struct literals gain `deadline: Duration`, and `NotADaemon` carries `endpoint: String`. See [tls.rs](../07-file-reference/client-tls.md).
