---
title: "loopctl-client"
sidebar:
  order: 7
---

`loopctl-client` is the family's fifth companion crate, and it lives in `crates/client/`. It gives you one object-safe client interface for everything daemon-facing, so no family binary smears the protocol across its internals.

Your CLI's daemon-facing verbs, your TUI's attach, stream, and approval surfaces, and future third-party clients all consume `DaemonClient`. In-process consumers implement the same `LoopctlClient` interface, so you pick a mode without your call sites changing shape.

The crate keeps `default = []`, and the `tls` feature pulls its only optional dependencies. It publishes after loopctl, like the other companions, and it builds on every platform since 0.6.0. The socket endpoint stays Unix-only by design, while TCP, TLS, the verbs, and the event stream run anywhere.

## Endpoints and authentication

Your `ConnectOptions` carries an `Endpoint` since 0.6.0. Pick one of four shapes.

| Endpoint | What it gives you |
|---|---|
| `Endpoint::socket(path)` | The per-user unix socket, as before. Autospawn runs here. |
| `Endpoint::tcp(host, port, token)` | Plain TCP for a trusted network. Your token crosses in the clear. |
| `Endpoint::tls(...)` | TLS behind the `tls` feature, against a CA you name or the public roots. |
| `Endpoint::mtls(...)` | TLS plus a client identity PEM, for daemons that authenticate clients. |

Remote endpoints authenticate with a bearer token on every request, the handshake included. A 401 or 403 answer surfaces as the typed `ClientError::Unauthorized`.

Your token never renders through `Debug`. Endpoints, options, and connected clients all print `<redacted>`. A token or host carrying CR, LF, or NUL refuses as a typed transport error before any bytes reach the wire.

Every exchange answers within one deadline. Set `ConnectOptions::with_deadline` to tune it, with 30 seconds as the default. The handshake, each verb, and a subscription's establishing head all obey it, so a stalled daemon cannot hang you. The event stream itself stays unbounded by design.

Three breaks ride 0.6.0. `ConnectOptions.socket_path` became `ConnectOptions.endpoint`, struct literals gain a `deadline: Duration` field, and `ClientError::NotADaemon` carries `endpoint: String` instead of `path: PathBuf`. The constructors keep their shape, so `ConnectOptions::new(path)` still builds the socket endpoint.

## The wire dialect

Your wire dialect is HTTP/1.1 REST plus SSE. Over the socket you reach a per-user unix socket at `$XDG_RUNTIME_DIR/loopctl/loopctl.sock`. Over TCP and TLS you reach the `host:port` you named, and the request's `Host` header carries that authority, with an IPv6 literal bracketed. Paths are `/v1`-versioned and bodies are JSON.

A deliberately minimal in-crate transport carries it. It opens one connection per request, speaks no HTTP/2 or redirects, and refuses where the dialect ends rather than guessing. TLS rides the same transport behind the `tls` feature.

### Three response framings

A compliant peer may use any of these, and the client reads all three:

- A declared `Content-Length`.
- Chunked transfer coding, decoded incrementally through a cancel-safe state machine. Every phase transition commits only after its bytes are consumed, so a dropped and recreated read resumes exactly where the last completed step left off.
- Close-delimiting.

### Bounds against unbounded peers

Three caps protect you: a 64 KiB head cap, a 4 MiB line cap, and a 10 MiB one-shot body cap. Conflicting duplicate `Content-Length` headers are refused.

The reader compacts its buffer as frames are consumed, so a long subscription's memory tracks your unread window rather than the stream's lifetime.

Since 0.6.0 the wire contract refuses where it used to tolerate. An interim `1xx` head is skipped to the final head. A chunked trailer section past 64 lines refuses. A 2xx subscription whose media type is not `text/event-stream` refuses, with parameters tolerated.

An event frame that never meets its blank line refuses at the 4 MiB bound, and a cursor that does not advance refuses the feed.

A 204 answers bodyless whatever its head claims. An error body drains under 64 KiB and your deadline, so the status survives a flooded body.

### The versioned handshake

Your client calls `GET /v1/hello` and reads back `{family, protocol, floor}`. Construction then refuses a family member outside the negotiated floor in either direction.

Three cases reject, and each names both sides: a foreign family, a server below your client's floor, and a server whose own floor sits above your client's version. An old or too-new peer is never silently absorbed.

## The verbs and the stream

| Surface | What it covers |
|---|---|
| Loops | `ls`, `get` |
| Runs | `start`, `get`, `stop` |
| Gates | `ls`, then `approve` or `deny` with reasons |
| Schedules | `ls`, `run_now` |

Your observation surface is `subscribe(loop, since)`, which returns an SSE stream. Its `id:` is your resume cursor, and its `data:` carries one trajectory-JSONL event.

Those event types are the [event ledger](/extensions/event-hub/) interchange types, reused from `loopctl::memory::trajectory`, so your wire and your ledger cannot drift.

The reader also handles multi-`data:` joins, comments, and `retry:` lines. An HTTP `410` maps to the typed `CursorExpired`, which states the relist contract to you.

In-process consumers adapt their own event sources through `EventStream::from_pin_box`, so your subscription surface is mode-unified in full.

Errors are typed throughout:

- Envelopes carry `{status, code, message}`.
- `Unauthorized` is the credential answer on any transport, added in 0.6.0.
- `SocketAbsent` is the in-process degrade signal, and the typed absence for a refused remote port.
- `ConnectTimeout` arrives under a bounded autospawn retry window, which retries transient handshake failures.

Autospawn stays a socket behavior. An absent remote daemon never starts one, because a daemon on another machine is not yours to start. Set `LOOPCTL_NO_AUTOSPAWN=1` when you want to disable spawning.

## The mode split, in one test

The crate's own suite pins the family's share-one-implementation claim in-repo. A second, in-process `LoopctlClient` implementation sits beside the daemon one behind the same `Box<dyn LoopctlClient>`.

That is one interface and both modes, exercised against a scripted local UDS server. The script pins your three framings, the handshake floors, all eleven verb paths and bodies, and the SSE cursor semantics.

## Related pages

- [The event hub and ledger](/extensions/event-hub/) covers the event types that ride your stream.
- [Approvals](/safety/approvals/) covers the gate verbs' engine-side counterpart.
- [Client crate, file reference](/file-reference/client-crate/) is the source-level detail.
