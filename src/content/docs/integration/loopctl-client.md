---
title: "loopctl-client"
sidebar:
  order: 7
---

`loopctl-client` is the family's fifth companion crate, and it lives in `crates/client/`. It gives you one object-safe client interface for everything daemon-facing, so no family binary smears the protocol across its internals.

Your CLI's daemon-facing verbs, your TUI's attach, stream, and approval surfaces, and future third-party clients all consume `DaemonClient`. In-process consumers implement the same `LoopctlClient` interface, so you pick a mode without your call sites changing shape.

The crate keeps `default = []` and adds no optional dependencies. It publishes after loopctl, like the other companions, and it is unix-only by design because your transport is the unix socket.

## The wire dialect

You get HTTP/1.1 REST plus SSE over a per-user unix socket at `$XDG_RUNTIME_DIR/loopctl/loopctl.sock`. Paths are `/v1`-versioned and bodies are JSON.

A deliberately minimal in-crate transport carries it. It opens one socket, speaks no TLS, HTTP/2, or redirects, and it uses one connection per request.

### Three response framings

A compliant peer may use any of these, and the client reads all three:

- A declared `Content-Length`.
- Chunked transfer coding, decoded incrementally through a cancel-safe state machine. Every phase transition commits only after its bytes are consumed, so a dropped and recreated read resumes exactly where the last completed step left off.
- Close-delimiting.

### Bounds against unbounded peers

Three caps protect you: a 64 KiB head cap, a 4 MiB line cap, and a 10 MiB one-shot body cap. Conflicting duplicate `Content-Length` headers are refused.

The reader compacts its buffer as frames are consumed, so a long subscription's memory tracks your unread window rather than the stream's lifetime.

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
- `SocketAbsent` is the in-process degrade signal.
- `ConnectTimeout` arrives under a bounded, visible autospawn retry window.
- Set `LOOPCTL_NO_AUTOSPAWN=1` when you want to disable spawning.

## The mode split, in one test

The crate's own suite pins the family's share-one-implementation claim in-repo. A second, in-process `LoopctlClient` implementation sits beside the daemon one behind the same `Box<dyn LoopctlClient>`.

That is one interface and both modes, exercised against a scripted local UDS server. The script pins your three framings, the handshake floors, all eleven verb paths and bodies, and the SSE cursor semantics.

## Related pages

- [The event hub and ledger](/extensions/event-hub/) covers the event types that ride your stream.
- [Approvals](/safety/approvals/) covers the gate verbs' engine-side counterpart.
- [Client crate, file reference](/file-reference/client-crate/) is the source-level detail.
