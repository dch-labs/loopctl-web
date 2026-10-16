---
title: "src/middleware/redaction.rs"
---

This file scrubs secrets from tool output before anything else sees them, under the `redaction` feature. Put it in your chain when your tools read files you do not control.

## Key items

You build the layer with `RedactingMiddleware::new(SecretPatternSet)`.

Your `SecretPatternSet::default_common()` ships named regex patterns: `bearer`, `api_key_kv`, `aws_access_key`, `pem_private_key`, `github_pat`, and `gitlab_pat`.

Append your own patterns with `with_pattern(SecretPattern)`, and turn the heuristic off with `with_entropy_heuristic(false)`.

The entropy heuristic flags tokens of at least 32 chars carrying at least 4.5 bits/byte randomness as `[REDACTED:high_entropy]`. Hex hashes top out at 4.0 and stay visible to you.

## Behavior notes

Replacement shape is `[REDACTED:<kind>]` per match, and `scrub` returns the count for observability.

This layer works post-execution only. It rewrites text parts, multipart included, never touches images, never sets `is_error`, and preserves display hints, so it has zero effect on loop semantics.

Register it outer, before verifiers, so it also scrubs what your inner layers append.

Deep dive: [Middleware](/safety/middleware/).
