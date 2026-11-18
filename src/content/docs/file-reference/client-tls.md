---
title: "crates/client/src/tls.rs"
---

The TLS carrier for remote daemon endpoints. It loads your trust material, performs the TCP connect and the TLS handshake, and hands the encrypted stream to the shared reader. Everything above the transport stays the same. Only the bytes are ciphertext. Added in 0.6.0 with the `tls` feature.

## Key items

- `connect(host, port, ca_pem, client_identity)`. One entry that resolves the endpoint, reads your CA PEM and optional client identity off the worker, and returns the boxed `Wire`.
- `ClientError::SocketAbsent`. What a refused TCP port answers.
- `ClientError::Transport`. What every other IO, resolution, or TLS failure answers.

## Behavior notes

Call `connect` through `Endpoint::tls` or `Endpoint::mtls` rather than directly. Your `ConnectOptions` builder owns the paths.

Verification fails closed. A certificate that does not verify never degrades to an unverified connection, and a wrong CA refuses the handshake outright so no request rides it.

Pass a `ca_pem` path for a self-hosted daemon's own certificate authority. Leave it unset and the client verifies against the public WebPKI roots, which suits a daemon named in a publicly-trusted certificate. The host doubles as the TLS server name, so the daemon's certificate must cover it.

Give `client_identity` a single PEM file, certificate chain first and then the private key, when your daemon authenticates clients by certificate. The file is read through `spawn_blocking`, so a stalled filesystem read cannot block the worker.

A file that cannot be read, is not PEM, holds no certificates, or holds no private key refuses with its own diagnosis before the connection opens.

You need the `tls` feature for this module. The crate compiles without it everywhere, and the socket endpoint stays Unix-only.
