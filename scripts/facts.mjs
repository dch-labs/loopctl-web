#!/usr/bin/env node
/**
 * Fact-drift gate. Prose may be rewritten; facts may not vanish.
 *
 *   node scripts/facts.mjs <reference-dir> [current-dir]
 *
 * Compares load-bearing tokens (code spans, fenced code, numbers with units,
 * file paths, flags, env vars, URLs, anchors, multi-word identifiers) and fails
 * on anything present in the reference copy and missing from the current one.
 * Compound tokens survive if a real component survives, because "no TLS, no
 * HTTP/2" is the same fact as "no TLS/HTTP/2".
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const [refDir, curDir = "src/content/docs"] = process.argv.slice(2);
if (!refDir) { console.error("usage: node scripts/facts.mjs <reference-dir> [current-dir]"); process.exit(2); }

function walk(dir, out = []) {
  if (statSync(dir).isFile()) { out.push(dir); return out }
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.mdx?$/.test(name)) out.push(p);
  }
  return out;
}

function tokens(md) {
  const body = md.replace(/^---[\s\S]*?^---\s*/, "");
  const out = new Set();
  const add = (s) => { if (s.length > 1) out.add(s.trim()); };
  const inline = [...body.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const fences = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const c of [...inline, ...fences.flatMap((f) => f.split("\n"))]) {
    if (!c.trim()) continue;
    add(c);
    for (const w of c.match(/[A-Za-z_][\w.():-]{2,}/g) || []) add(w);
  }
  for (const u of [...body.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1])) add(u);
  for (const a of [...body.matchAll(/^#+\s+\{#([^}]+)\}/gm)]) add(a[1]);
  // numbers with units, and multi-word identifiers worth keeping
  for (const n of body.match(/\b\d[\d,._]*\s?(?:%|ms|s|MB|GB|KiB|MiB|GiB|tok|tokens|steps|epochs|x)?\b/g) || []) {
    if (n.trim().length > 1) add(n.replace(/\s+/g, ""));
  }
  for (const w of body.match(/[A-Za-z_][A-Za-z0-9_.:/-]{3,}/g) || []) {
    if (/[_.\-/]/.test(w) || (/^[A-Z]/.test(w) && !/^[A-Z][a-z]+$/.test(w))) add(w);
  }
  return out;
}

const clean = (t) => t.replace(/[.,;:!?"'()]+$/g, "");
const survives = (t, blob) => {
  if (blob.includes(t.toLowerCase())) return true;
  return t.split(/[-/_.:]/).some((c) => c.length >= 5 && blob.includes(c.toLowerCase()));
};

let checked = 0;
let failing = 0;
for (const file of walk(refDir)) {
  const rel = relative(refDir, file);
  const now = join(curDir, rel);
  if (!existsSync(now)) { console.log(`MISSING ${rel}`); failing++; continue; }
  const before = new Set([...tokens(readFileSync(file, "utf8"))].map(clean));
  const nowText = readFileSync(now, "utf8").toLowerCase();
  const after = new Set([...tokens(readFileSync(now, "utf8"))].map(clean));
  const lost = [...before].filter((t) => t.length > 2 && !after.has(t) && !survives(t, nowText)).sort();
  checked++;
  if (lost.length) {
    failing++;
    console.log(`LOST (${lost.length}/${before.size}) ${rel}\n   ` + lost.join("\n   "));
  }
}
console.log(`\n${checked} pages compared, ${failing} with facts that vanished`);
if (failing) process.exit(1);
