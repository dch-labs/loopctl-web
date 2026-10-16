#!/usr/bin/env node
/**
 * Style gate for the knowledge base. Reports per-page prose metrics and checks
 * every internal link and heading anchor. Structural breakage always fails;
 * prose thresholds fail only with --strict.
 *
 *   node scripts/style.mjs                 # report
 *   node scripts/style.mjs --strict        # enforce the thresholds
 *   node scripts/style.mjs engine safety   # only these sections
 *
 * Bar: docs.tinygrad.org. See STYLE.md.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = "src/content/docs";

// The numbers from STYLE.md. avgSentence is the hard line; its target is 17.
const LIMITS = {
  avgSentence: 20, maxSentence: 30, paraWords: 50, emdash: 0, semi: 0,
  youPerK: 15, parenPerK: 3, verbPerK: 15,
};

const ACTION = /\b(?:can|cannot|must|need|needs|run|runs|running|set|sets|pass|passes|call|calls|add|adds|use|uses|write|writes|keep|keeps|make|makes|let|lets|read|reads|send|sends|return|returns|build|builds|define|defines|start|starts|stop|stops|check|checks|give|gives|try|tries)\b/gi; // a sentence-initial "Set the threshold" is still a plain verb

const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const only = argv.filter((a) => !a.startsWith("--"));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.mdx?$/.test(name)) out.push(p);
  }
  return out;
}

function stripBody(md) {
  const keep = [];
  let fence = false;
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("```")) { fence = !fence; continue; }
    if (fence) continue;
    if (/^\s*\|/.test(line)) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^\s*>/.test(line)) continue;
    // A list item is its own paragraph, and a rule ends one.
    if (/^\s*(?:[-*+]\s|\d+\.\s)/.test(line)) keep.push("");
    if (/^\s*-{3,}\s*$/.test(line)) { keep.push(""); continue; }
    keep.push(line);
  }
  return keep.join("\n");
}

function slugOf(text) {
  return text
    .toLowerCase()
    .replace(/\{#[^\}]+\}\s*$/, "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

function headings(md) {
  const ids = new Set();
  let fence = false;
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("```")) { fence = !fence; continue; }
    if (fence) continue;
    const m = line.match(/^#{1,6}\s+(.+)$/);
    if (!m) continue;
    const custom = m[1].match(/\{#([^}]+)\}\s*$/);
    ids.add(custom ? custom[1] : slugOf(m[1].trim()));
  }
  return ids;
}

const stripInline = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "");

function metrics(body) {
  // Split sentences on raw text: a sentence may open with a code identifier,
  // and stripping backticks first would hide that boundary.
  const raw = stripBody(body);
  const paras = raw
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.split(" ").length >= 4);
  const sents = [];
  const starts = [];
  for (const p of paras) {
    const parts = p.split(/(?<=[.!?])\s+(?=[A-Z"'(`$])/);
    const firsts = [];
    for (const rawSent of parts) {
      const s = stripInline(rawSent);
      if (s.split(" ").length < 2) continue;
      sents.push(s);
      firsts.push((stripInline(rawSent).toLowerCase().match(/^[a-z']+/) || [""])[0]);
    }
    for (let i = 2; i < firsts.length; i++) if (firsts[i] && firsts[i] === firsts[i - 1] && firsts[i] === firsts[i - 2]) starts.push(p.slice(0, 40));
  }
  const words = sents.reduce((n, s) => n + s.split(" ").length, 0) || 1;
  const lens = sents.map((s) => s.split(" ").length).sort((a, b) => a - b);
  const txt = sents.join(" ");
  const per1k = (n) => Math.round((1000 * n) / words * 10) / 10;

  // A parenthetical of six or more words wants its own sentence.
  let parenN = 0;
  for (const m of txt.matchAll(/\(([^()]*)\)/g)) if ((m[1].match(/[\w'.-]+/g) || []).length >= 6) parenN++;

  const emdN = (txt.match(/\u2014|\u2013/g) || []).length;
  const semiN = (txt.match(/\w\s*;\s*\w/g) || []).length;
  return {
    words,
    sents: sents.length,
    avg: lens.length ? Math.round((words / sents.length) * 10) / 10 : 0,
    max: lens.at(-1) ?? 0,
    over40: lens.filter((x) => x > 40).length,
    paraMax: paras.reduce((n, p) => Math.max(n, stripInline(p).split(" ").length), 0),
    emdN,
    semiN,
    emd: per1k(emdN),
    semi: per1k(semiN),
    you: per1k((txt.match(/\b(?:you|your)\b/gi) || []).length), // a sentence-initial "You" still addresses the reader
    paren: per1k(parenN),
    verb: per1k((txt.match(ACTION) || []).length),
    starts,
    longest: sents.reduce((a, s) => (s.split(" ").length > (a || "").split(" ").length ? s : a), ""),
  };
}

const all = walk(ROOT);
const selected = new Set(
  all.filter((p) => {
    const rel = relative(ROOT, p);
    return only.length === 0 || only.includes(rel.split("/")[0]) || only.includes(rel.replace(/\.mdx?$/, ""));
  }),
);

// Anchors and pages are resolved against the whole corpus, never the selection,
// or filtering by section reports every cross-section link as broken.
const anchors = new Map();
const rows = [];
for (const file of all) {
  const raw = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\.mdx?$/, "/").replace(/index\/$/, "");
  anchors.set("/" + rel, headings(raw));
  if (!selected.has(file)) continue;
  const body = raw.replace(/^---[\s\S]*?^---\s*/, "");
  rows.push(Object.assign({ rel, key: "/" + rel }, metrics(body)));
}

const broken = [];
for (const file of selected) {
  const raw = readFileSync(file, "utf8");
  const body = raw.replace(/^---[\s\S]*?^---\s*/, "");
  const from = relative(ROOT, file).replace(/\.mdx?$/, "/");
  let fence = false;
  for (const line of body.split("\n")) {
    if (line.trim().startsWith("```")) { fence = !fence; continue; }
    if (fence) continue;
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (/^(https?:|mailto:)/.test(href)) continue;
      let target = href;
      let anchor = null;
      const h = href.indexOf("#");
      if (h >= 0) { target = href.slice(0, h); anchor = href.slice(h + 1); }
      let key;
      if (target.startsWith("/")) {
        key = target.endsWith("/") ? target : target + "/";
      } else if (target === "") {
        key = "/" + from;
      } else {
        const abs = resolve(dirname(join(ROOT, from)), target);
        key = "/" + relative(ROOT, abs).replace(/\.mdx?$/, "/");
        if (!existsSync(abs) && !existsSync(abs + ".md") && !existsSync(join(abs, "index.md"))) {
          broken.push({ from, href, why: "no such page" });
          continue;
        }
      }
      if (!anchors.has(key)) { broken.push({ from, href, why: "no such page" }); continue; }
      if (anchor && !anchors.get(key).has(anchor)) broken.push({ from, href, why: "no such heading anchor" });
    }
  }
}

rows.sort((a, b) => b.avg - a.avg);
const bad = (r) => {
  const why = [];
  if (r.avg > LIMITS.avgSentence) why.push("avg");
  if (r.max > LIMITS.maxSentence) why.push("max");
  if (r.paraMax > LIMITS.paraWords) why.push("para");
  if (r.emdN > LIMITS.emdash) why.push("emdash");
  if (r.semiN > LIMITS.semi) why.push("semi");
  if (r.you < LIMITS.youPerK) why.push("you");
  if (r.paren > LIMITS.parenPerK) why.push("paren");
  if (r.verb < LIMITS.verbPerK) why.push("verbs");
  if (r.starts.length > 0) why.push('starts("' + r.starts[0] + '")');
  r.why = why;
  return why.length > 0;
};
const fails = rows.filter(bad);

console.log(`bar: avg <=${LIMITS.avgSentence} (target ${LIMITS.avgSentence - 3})  max <=${LIMITS.maxSentence}  para <=${LIMITS.paraWords}  ` +
  `you >=${LIMITS.youPerK}/k  verbs >=${LIMITS.verbPerK}/k  paren <=${LIMITS.parenPerK}/k  emdash 0  semicolons 0  repeated starts 0`);
console.log(" avg  max  para verbs   you paren  emd semi  page");
for (const r of rows) {
  console.log(
    r.avg.toFixed(1).padStart(5) + " " + String(r.max).padStart(4) + " " + String(r.paraMax).padStart(5) +
    " " + r.verb.toFixed(1).padStart(6) + " " + r.you.toFixed(1).padStart(6) + " " + r.paren.toFixed(1).padStart(6) +
    " " + r.emd.toFixed(1).padStart(5) + " " + r.semi.toFixed(1).padStart(4) +
    "  " + r.rel + (r.why.length ? "  <<< " + r.why.join(",") : ""),
  );
}
const tw = rows.reduce((n, r) => n + r.words, 0);
const ts = rows.reduce((n, r) => n + r.sents, 0) || 1;
const t40 = rows.reduce((n, r) => n + r.over40, 0);
console.log(`\n${rows.length} pages, ${tw} words, ${ts} sentences | avg ${(tw / ts).toFixed(1)} w/sent, ` +
  `${((100 * t40) / ts).toFixed(1)}% over 40 | ${fails.length} pages over threshold`);
if (broken.length) {
  console.log(`\nBROKEN LINKS (${broken.length}):`);
  for (const b of broken) console.log(`  ${b.from} -> ${b.href}  (${b.why})`);
  process.exit(1);
}
console.log("\nlinks: all internal links and heading anchors resolve");
if (strict && fails.length) { console.log("FAILED: pages over threshold (<<< above)"); process.exit(1); }
