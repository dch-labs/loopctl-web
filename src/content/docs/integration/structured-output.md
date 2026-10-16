---
title: "Structured output"
sidebar:
  order: 1
---

Free-text replies are fine for chat and useless for code. Structured output makes your model answer with JSON matching a schema you define, so you deserialize straight into a Rust type.

The source is `src/structured.rs`.

## The trait: describe your type once

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

Your `name()` must match `^[a-zA-Z0-9_-]+$`, which is the convention because it becomes the schema's name on the wire.

## One-shot helper: request_structured

Use this for standalone calls outside the agent loop:

```rust
let result: Classification = loopctl::structured::request_structured(
    &*client,
    vec![Message::user("Classify: 'The package arrived broken'")],
    Some("You classify support messages.".into()),
).await?;
```

Here is what happens under the hood. Your type's `ResponseFormat` is set, one non-streaming request goes out, the JSON is extracted, and `from_value` runs.

That extraction, in `extract_structured`, prefers a tool-call payload if one is present. Otherwise it parses your text leniently and takes the outermost balanced `{...}` or `[...]` it finds inside prose or markdown fences.

There is no retry on parse failure, so a malformed answer surfaces as `StructuredError::Deserialize`. Retrying with clearer instructions is your call.

## Providers without native support: request_structured_prompted

Most local models behind Ollama or vLLM reject or ignore `response_format`, and since 0.3.0 loopctl refuses request options a client cannot forward rather than silently downgrading them.

For those providers there is a second one-shot helper, `request_structured_prompted`. It gets you structured answers without any structured-output wire feature at all:

- Your type's minified JSON Schema is embedded in the system prompt with strict-JSON
  instructions. `structured::prompted_system_prefix` is public if you want to compose your
  own flow, and a caller-supplied system prompt is prepended rather than replaced.

- The request goes out as a plain `create_message` with no `RequestOptions` and no tools
  payload, so there is nothing for a local server to reject.

- The answer is extracted with the same lenient scanner, so fences and prose-wrapped JSON
  are accepted.

- On a parse or schema failure, exactly one corrective retry feeds the concrete error
  back to your model. The failed answer is replayed as a text-only assistant turn, and the
  corrective message is bounded to 2,000 characters.

- A second failure returns `StructuredError::Deserialize` with the reason and the
  truncated last output.

```rust
let result: Classification = loopctl::structured::request_structured_prompted(
    &*client,                                     // any ApiClient — no options support needed
    vec![Message::user("Classify: 'The package arrived broken'")],
    Some("You classify support messages.".into()),
).await?;
```

As a rule of thumb, prefer `request_structured` on providers with native support, and reach for the prompted variant when your model cannot honor `response_format`. Both extract through the same scanner, so switching later is mechanical.

## Inside the agent loop: set_request_options

```rust
agent.set_request_options(
    RequestOptions::new().with_response_format(ResponseFormat::from_type::<Classification>())
);
```

Now every model request carries your format. Here is what happens per provider:

| Provider | How the format is enforced |
|---|---|
| OpenAI | A native `json_schema` response format, strict |
| Anthropic | Synthesized as a single forced tool, so the answer arrives as a tool-call payload |
| Gemini | `responseMimeType: application/json` plus `responseJsonSchema` |

One universal rule: a response format suppresses `tools` for that request, because the format occupies the same slot. A turn under a format is a Q&A turn rather than a tool-using turn.

Since 0.4.0 the engine's estimate is honest about that. The suppressed tool schemas are no longer reserved.

OpenAI and Gemini drop `tools` outright, while Anthropic swaps in one synthesized forced tool that is uncounted, which is a bounded under-reserve.

## Thinking effort: how hard the model thinks

Reasoning models take a budget knob. Set `RequestOptions::effort(ThinkingEffort::…)` to `Off`, `Low`, `Medium`, `High`, or `Max`, and the three built-in clients can pin a default for every request through `thinking_effort(...)` on their builders.

Effort rides the wire where your provider supports it, and an unsupported combination is rejected loudly, like every other option.

## The three ToolConstraint modes, for tool-calling turns

This is a separate knob, and it applies when tools are advertised:

```rust
RequestOptions::new().with_tool_constraint(ToolConstraint::Strict)
```

| Mode | Effect |
|---|---|
| `None`, the default | Schemas ride as-is, and malformed calls are answered with errors rather than prevented |
| `Strict` | Schemas are tightened, which means every object is closed via `additionalProperties: false` and every property is required, plus native strict flags where they exist, so malformed calls are largely prevented at the source |
| `Grammar(provider)` | Sampler-level constraint for local servers, and [grammar](/providers/grammar/) covers it |

The tightening transform is loopctl's own and is called `tighten_json_schema`. It recurses through nested objects, arrays, `allOf`, `anyOf`, `oneOf`, and `$defs`, and it is idempotent.

It exists because OpenAI's strict mode requires closed, fully-required schemas, and without it your strict requests bounce with a 400.

### The tightening transform, exactly

Here is the precise algorithm, for when you need to predict what your schema becomes:

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

Two non-goals are as deliberate as the actions. `$ref` references are not followed, because there is no schema registry to resolve against, and `if`, `then`, `else` conditionals are left alone.

A schema that relies on either will tighten only its explicit object nodes.

### The lenient extractor, step by step

This is the fallback that rescues JSON from prose, and it is a small state machine over your reply's bytes:

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

The "outermost candidate that parses" rule is what survives messy output such as markdown fences, a prose prefix, or an array of objects. The first complete, parseable value found is your answer.

A balanced-but-invalid candidate like `{"a": }` is abandoned rather than fatal, so garbage before your real payload does not sink the extraction.

## Rejections, not silent downgrades

Three cases fail loudly before any bytes hit your network:

- A client that does not support options at all, meaning the default `ApiClient` methods,
  fails with `ApiError::config` naming the unsupported field.
- A `strict: true` response format on Anthropic or Gemini fails with
  `ApiError::config_validation`, because no strict switch exists there.
- A `Grammar` constraint on Anthropic or Gemini hits the same rejection.

`ResponseFormat::new(name, schema)` exists for when the shape is not known at compile time, and it gives you dynamic schemas that are strict by default.

## Gotchas

1. `request_structured` has no parse-failure retry, and your model will occasionally wrap
  JSON in prose on weak models. The lenient extractor handles the common cases, but plan a
  retry loop for flaky models.

2. Schema quality is on you. The framework does not validate hand-written schemas except
  when you serve MCP tools, so test them.

3. `with_model("")` is ignored, since empty or whitespace model overrides never apply.

4. Anthropic's forced-tool answers look like tool calls on the wire, and
  `extract_structured` prefers a tool-call payload precisely for that reason, so do not
  bypass it.

5. Per-request sampling knobs, meaning temperature, top-p, stop sequences, and max tokens,
  are deliberately not part of `RequestOptions`. Set what your client exposes, such as
  `max_tokens` on the Anthropic or Bedrock builders.

## Related pages

- [Grammar](/providers/grammar/) covers the local-model mode.
- [API client](/core-data/api-client/) is where options are honored or rejected.
