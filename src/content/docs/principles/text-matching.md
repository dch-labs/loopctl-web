---
title: "Text matching — similarity without understanding"
sidebar:
  order: 12
---


Several places in loopctl must ask a fuzzy question: *"did the model mean `read_file` when it asked for `read_fille`?"* or *"which memory entries have anything to do with this query?"* There is no language model available to answer — the engine is *made of* the model's plumbing, and these questions must be answered instantly, offline, every call.

The answer is a family of **character-and-word tricks**: similarity measures that understand nothing about meaning but are fast, dependency-free, and wrong in known, bounded ways. loopctl uses three of them (plus Jaccard, covered with [convergence detection](/principles/measuring-repetition/)). This page explains each with its real formula and a worked example.

---

## 1. Longest common subsequence — "did you mean...?"

When a dispatched call misses the registry, `UnknownToolMiddleware` appends a suggestion: `Did you mean 'read_file'?` The similarity behind it is the **longest common subsequence** (LCS) — the longest sequence of characters that appears in *both* strings, in order, with gaps allowed:

```text
"read_fille"   r e a d _ f i l l e
"read_file"    r e a d _ f i l   e
LCS:           r e a d _ f i l   e   → length 9 of a max length of 10
```

"Subsequence, not substring" is the point: the extra `l` in the typo doesn't break the match, because matching may skip it. The similarity score:

```text
similarity = LCS_length / max(len_a, len_b)        (after lowercasing)
           + 0.1 × (shared leading characters / max length)   ← prefix bonus
```

The **prefix bonus** rewards names that start the same way — `read_fille` vs `read_file` shares 8 leading characters, so:

```text
LCS part:      9/10 = 0.90
prefix bonus:  0.1 × 8/10 = 0.08
similarity:    0.98        → suggested

vs "write_file":  LCS = 7 ("r_e_file"), prefix = 0 → 0.70   (also above
                  threshold, but 0.98 wins — best match is suggested)
```

The middleware suggests the **best** scoring registered name, but only above a threshold (default **0.4**) — below it, silence beats a nonsense suggestion.

### How LCS is computed — the classic dynamic-programming trick

Finding the LCS by trying every subsequence would explode combinatorially. The insight that makes it cheap: *the LCS of two strings can be built from the LCS of their prefixes.* Fill a table where cell `(i, j)` = LCS length of the first `i` characters of A and first `j` of B:

```text
            f   i   l   e          ← B = "file"
        0   0   0   0   0
    f   0   1   1   1   1
    i   0   1   2   2   2        cell rule:
    l   0   1   2   3   3          chars match → 1 + up-left neighbor
    e   0   1   2   3   4          else        → max(up, left)
```

Each cell costs constant work, so the whole table is O(len × len) time — and since only the previous *row* is ever read, only two rows are kept: memory O(min(len)). Tool names are short, so this runs in nanoseconds; the same algorithm scales to diff tools on whole files.

Run the full matrix for the typo pair `"fille"` vs `"file"` — the double `l` surviving is visible in the numbers:

```text
                  f   i   l   e        ← B = "file" (columns)
              0   0   0   0   0
        f     0   1   1   1   1
        i     0   1   2   2   2
A =     l     0   1   2   3   3        the second 'l' row repeats the
"fille" l     0   1   2   3   3        first — an unmatched char can
        e     0   1   2   3   4        never raise the count, only the
                                      matching 'e' at the end can: 3 → 4
```

Bottom-right: LCS = 4, so `4/5 = 0.80`, plus a prefix bonus of `0.1 × 3/5 = 0.06` (they share `f`, `i`, `l` up front) → **0.86**, comfortably above the 0.4 threshold.

And `similarity()`, end to end — the exact order of operations:

```text
similarity(a, b):
  1. both empty → 1.0;      one empty → 0.0        (degenerate cases first)
  2. lowercase both; equal → 1.0                    (free fast path — most real
                                                      tool-name matches are typos, not case)
  3. lcs = LCS-length over the char vectors        (the two-row DP above)
  4. prefix = count of equal leading characters     (zip + take_while — stops at first mismatch)
  5. score = lcs/max_len  +  (prefix > 0 ? 0.1 × prefix/max_len : 0)
  6. clamp to [0, 1]
```

The suggestion itself is then a max-search over registered names: the best scorer wins, and it is *suggested at all* only if it clears the threshold (`with_threshold` — lower it for more suggestions and more false positives, raise it for fewer of each).

## 2. Word overlap — "is this memory relevant?"

The built-in memory store ([memory](/extensions/memory/)) must rank which stored entries a new question should surface. No embeddings — just counting shared words. Each candidate entry scores:

```text
score = 0.5 × entry.relevance                                  ← its stored importance
      + 0.4 × (query words found in the entry text / total query words)
      + 0.3 × (1 if any tag contains the whole query, else 0)
      + 0.1                                                     ← baseline
```

Worked example — query `"deploy the blue service"`, two entries:

| Entry | relevance | word hits | tag? | score |
|---|---|---|---|---|
| `"deploys go to the blue cluster"` (tags: infra) | 0.8 | deploy, the, blue → 3/4 = 0.75 | no | 0.5×0.8 + 0.4×0.75 + 0 + 0.1 = **0.80** |
| `"meetings are on tuesdays"` (tags: deploy) | 1.0 | the → 1/4 = 0.25 | yes | 0.5×1.0 + 0.4×0.25 + 0.3 + 0.1 = **1.00** |

The scorer, line by line — including the two details the formula alone doesn't show:

```text
retrieve(query, limit):
  1. query_words = query, lowercased, split on whitespace
  2. snapshot the entries under the lock; DROP the lock; score the snapshot
     (readers never block writers — the contract is pinned by a test)
  3. per entry:
       word_matches = how many query words appear as SUBSTRINGS
                      anywhere in the entry's lowercased text
       query_bonus  = word_matches / max(query_words.len(), 1)
       tag_bonus    = 0.3 if ANY tag contains the whole query as a substring
       score        = relevance×0.5 + query_bonus×0.4 + tag_bonus + 0.1
  4. sort by score, descending; take the first `limit`
```

The substring detail in step 3 is doing quiet work: `"deploy"` matches `"deploys"`, `"deployed"`, `"deployment"` — word-*stemming* for free, at the cost of also matching `"deployed"` inside unrelated words. And the snapshot discipline in step 2 is the whole "cheap store" trick: scoring a large snapshot costs nothing to writers, so retrieve stays lock-friendly no matter how slow the scoring grows.

Two honest omissions in the built-in store, deliberate: it never increments `access_count` (popularity is untracked — nothing rewards being retrieved), and its `consolidate()` is a single `retain(relevance ≥ 0.05)` — no merging, no decay. Popularity and forgetting are left for real backends to do properly; the reference implementation stays small enough to verify by reading.

Notice what the example exposes: the tag bonus and high relevance let a *less relevant* entry win. That's the honest character of word counting — it measures **overlap, not meaning**, and the weights are where you tune what "relevant" means. Matching is case-insensitive substring containment (a query word counts if it appears *anywhere* in the entry text). The `+0.1` baseline guarantees nothing scores exactly zero, so a top-k retrieval always has a full page of candidates to return, even on weak matches.

When overlap isn't enough, the store is a trait — a vector database with embedding similarity slots in behind the same three verbs, and the engine never knows the difference.

## 3. Balanced-brace scanning — "find the JSON in the prose"

Models asked for JSON sometimes answer with the JSON *embedded in chit-chat*: `Sure! {"answer": 42} hope that helps`. The lenient structured-output extractor ([structured output](/integration/structured-output/)) recovers it by scanning the text for a `{...}` block whose braces balance — tracking depth (a `{` inside a string literal doesn't count), taking the first block that opens and closes evenly. First try the strict paths (a tool-call argument, then whole-text JSON parse); only when those fail does the scan run. Cheap, order-sensitive, wrong only in prose that *contains* unbalanced-looking braces — which prose rarely does.

## Why order matters — and when it must not

Line the four matchers up and a design decision falls out:

| Matcher | Unit | Order-sensitive? | Used for | Why that fits |
|---|---|---|---|---|
| LCS | characters | **yes** — order is the signal | typo suggestions | typos preserve order, break spelling |
| Word overlap | words | no (counting) | memory relevance | word presence ≈ topic, order is noise |
| Jaccard (sets) | words | no (sets) | convergence | rewording must not hide repetition |
| Brace balance | characters | **yes** — nesting is the signal | JSON extraction | structure is literal |

**The rule the table encodes: choose your insensitivity deliberately.** When "same characters, same order-ish" means *same intent* (typos, JSON), use an order-aware matcher. When intent survives rewording (topics, repeated answers), throw order away — an order-sensitive matcher on reworded text would miss everything. Each loopctl matcher sits on the side of that line its question requires.

All four share the family virtues: no model calls, no dependencies, sub-millisecond, and failure modes you can name in one sentence. For the questions where that's not enough, the trait boundaries (memory store, extractors) are where heavier machinery plugs in.

---

## Related pages

- [Memory](/extensions/memory/) — the store the word-overlap scorer serves.
- [Middleware](/safety/middleware/) — where the suggestion layer sits.
- [Windows, averages, and similarity](/principles/measuring-repetition/) — Jaccard's full story.
- [Structured output](/integration/structured-output/) — the strict paths around the brace scanner.
