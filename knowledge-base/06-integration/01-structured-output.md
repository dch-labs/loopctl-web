# Structured output — answers you can parse

Free-text replies are fine for chat, useless for code. **Structured output** makes the model answer with JSON matching a schema you define, so you deserialize straight into a Rust type. Source: `src/structured.rs`.

---

## The trait — describe your type once

```rust
use loopctl::structured::StructuredOutput;

#[derive(serde::Deserialize)]
struct Classification {
    label: String,
    confidence: f64,
}

impl StructuredOutput for Classification {
    fn name() -> &'static str { "classification" }
    fn schema() -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "label":       { "type": "string" },
                "confidence":  { "type": "number" }
            },
            "required": ["label", "confidence"],
            "additionalProperties": false
        })
    }
    // from_value has a default: serde deserialization — override for
    // post-processing (defaults, trimming, cross-field validation)
}
```

`name()` must match `^[a-zA-Z0-9_-]+$` (convention — it becomes the schema's name on the wire).

## One-shot helper — `request_structured`

For standalone calls (outside the agent loop):

```rust
let result: Classification = loopctl::structured::request_structured(
    &*client,
    vec![Message::user("Classify: 'The package arrived broken'")],
    Some("You classify support messages.".into()),
).await?;
```

Under the hood: set a `ResponseFormat` from your type → one non-streaming request → extract the JSON (`extract_structured`: a tool-call payload if present, otherwise the text parsed leniently — the outermost balanced `{...}` or `[...]` found inside prose or markdown fences) → `from_value`. **No retry on parse failure** — a malformed answer surfaces as `StructuredError::Deserialize`; retrying with clearer instructions is your call.

## Providers without native support — `request_structured_prompted`

Most local models behind Ollama/vLLM reject or ignore `response_format` — and since 0.3.0, loopctl refuses request options a client cannot forward rather than silently downgrading them. For those providers there is a second one-shot helper: **`request_structured_prompted`**. It gets structured answers without any structured-output wire feature at all:

- Your type's minified JSON Schema is embedded **in the system prompt** with strict-JSON instructions (`structured::prompted_system_prefix` is public if you want to compose your own flow; a caller-supplied system prompt is prepended, never replaced).
- The request goes out as a plain `create_message` — **no `RequestOptions`, no tools payload**, so there is nothing for a local server to reject.
- The answer is extracted with the same lenient scanner (fences and prose-wrapped JSON accepted).
- On a parse or schema failure, **exactly one corrective retry** feeds the concrete error back to the model — the failed answer replayed as a text-only assistant turn, the corrective message bounded to 2,000 characters. A second failure returns `StructuredError::Deserialize` with the reason and the truncated last output.

```rust
let result: Classification = loopctl::structured::request_structured_prompted(
    &*client,                                     // any ApiClient — no options support needed
    vec![Message::user("Classify: 'The package arrived broken'")],
    Some("You classify support messages.".into()),
).await?;
```

Rule of thumb: prefer `request_structured` on providers with native support; reach for the prompted variant when the model can't honor `response_format`. Both extract through the same scanner, so switching later is mechanical.

## Inside the agent loop — `set_request_options`

```rust
agent.set_request_options(
    RequestOptions::new().with_response_format(ResponseFormat::from_type::<Classification>())
);
```

Now every model request carries the format. What happens per provider:

| Provider | How the format is enforced |
|---|---|
| OpenAI | native `json_schema` response format (strict) |
| Anthropic | **synthesized as a single forced tool** — the answer arrives as a tool-call payload |
| Gemini | `responseMimeType: application/json` + `responseJsonSchema` |

Universal rule: **a response format suppresses `tools`** for that request — the format occupies the same slot. A turn under a format is a Q&A turn, not a tool-using turn. (The engine's context estimate still reserves the tool-schema overhead for such turns — conservative, never under.)

## The three `ToolConstraint` modes — for tool-*calling* turns

Separate knob, applies when tools *are* advertised:

```rust
RequestOptions::new().with_tool_constraint(ToolConstraint::Strict)
```

| Mode | Effect |
|---|---|
| `None` (default) | schemas as-is; malformed calls answered with errors, not prevented |
| `Strict` | schemas **tightened** (every object closed via `additionalProperties: false`, every property required) + native strict flags where they exist — malformed calls largely prevented at the source |
| `Grammar(provider)` [feature: grammar] | sampler-level constraint for local servers — see [grammar](../05-providers/07-grammar.md) |

The tightening transform is loopctl's own (`tighten_json_schema`) — it recurses through nested objects, arrays, `allOf/anyOf/oneOf`, and `$defs`, and is idempotent. It exists because OpenAI's strict mode *requires* closed, fully-required schemas — without it, strict requests bounce with a 400.

### The tightening transform, exactly

The precise algorithm, for when you need to predict what your schema becomes:

```text
tighten(schema):
  1. recurse FIRST into: every value of "properties", "items",
     every member of allOf/anyOf/oneOf, every definition in
     $defs AND definitions
  2. act only if this node has "type": "object" (explicit) —
     a {"type":"string"} node is left structurally untouched
  3. insert "additionalProperties": false
  4. "required" = the union of whatever was already listed (original
     order, unknown entries survive) PLUS every property key not
     yet listed, appended in map order. An object with no
     "properties" gets "required": [] — present but empty.
```

Two non-goals are as deliberate as the actions: `$ref` references are **not followed** (there's no schema registry to resolve against), and `if`/`then`/`else` conditionals are left alone. A schema relying on either will tighten only its explicit object nodes.

### The lenient extractor, step by step

The fallback that rescues JSON from prose — a small state machine over the reply's bytes:

```text
scan(text), tracking: start position, brace depth, bracket depth,
                     in-string flag, escaped flag
  '{' or '[' with no candidate yet  → start a candidate here
  inside a "…" string               → only escapes and the closing quote matter
                                       (braces in strings never count)
  '{' / '[' during a candidate      → depth++
  '}' / ']' matching the open kind  → depth-- ; both depths back to zero
                                       → try parsing text[start..=here];
                                         the outermost candidate that PARSES wins
  '}' / ']' NOT matching (e.g. '{oops]') → abandon this candidate entirely,
                                       reset depths, keep scanning
                                       (a later well-formed value can still win)
```

The "outermost candidate that parses" rule is what makes it robust: markdown fences, a prose prefix, an array of objects — the first *complete, parseable* value found is the answer. And a balanced-but-invalid candidate (`{"a": }`) is abandoned rather than fatal, so garbage before the real payload doesn't sink the extraction.

## Rejections, not silent downgrades

Three cases fail loudly before any bytes hit the network:

- A client that doesn't support options at all (default `ApiClient` methods): `ApiError::config` naming the unsupported field.
- `strict: true` response formats on Anthropic/Gemini (no strict switch exists there): `ApiError::config_validation`.
- `Grammar` constraints on Anthropic/Gemini: same.

`ResponseFormat::new(name, schema)` (dynamic schemas, strict by default) exists for when the shape isn't known at compile time.

---

## Gotchas

1. **No parse-failure retry** in `request_structured` — the model *will* occasionally wrap JSON in prose on weak models; the lenient extractor handles the common cases, but plan a retry loop for flaky models.
2. **Schema quality is on you.** The framework doesn't validate hand-written schemas (except when serving MCP tools). Test them.
3. **`with_model("")` is ignored** (empty/whitespace model overrides never apply).
4. **Anthropic's forced-tool answers** look like tool calls on the wire — `extract_structured` prefers a tool-call payload precisely for this reason; don't bypass it.
5. Per-request **sampling knobs** (temperature, top-p, stop sequences, max tokens) are deliberately *not* part of `RequestOptions` — set what the client exposes (e.g. `max_tokens` on the Anthropic/Bedrock builders).

---

## Related pages

- [Grammar](../05-providers/07-grammar.md) — the local-model mode.
- [API client](../01-core-data/03-api-client.md) — where options are honored or rejected.
