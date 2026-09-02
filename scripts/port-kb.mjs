import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, posix } from 'node:path';

const SRC = resolve(process.argv[2] ?? 'knowledge-base');
const OUT = resolve('src/content/docs');

if (!existsSync(SRC)) {
  console.error(`knowledge base not found at ${SRC} — pass the path as the first argument`);
  process.exit(1);
}

const slugifySegment = (seg) => {
  const base = seg.replace(/\.md$/, '');
  const stripped = base.replace(/^\d+-/, '');
  if (base.toLowerCase() === 'readme') return 'index';
  return stripped
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-');
};

const destFor = (relPath) => {
  if (relPath === 'README.md') return 'guide.md';
  const parts = relPath.split(/[/\\]/).map((p, i, arr) =>
    i === arr.length - 1 ? (slugifySegment(p) === 'index' ? 'index.md' : slugifySegment(p) + '.md') : slugifySegment(p)
  );
  return posix.join(...parts);
};

const siteHref = (fromDir, target) => {
  const targetRel = posix.normalize(posix.join(fromDir, target));
  const dest = destFor(targetRel);
  const dir = posix.dirname(dest);
  const base = posix.basename(dest, '.md');
  if (base === 'index') return `/${dir}/`;
  return dir === '.' ? `/${base}/` : `/${dir}/${base}/`;
};

const rewriteLinks = (body, relDir) => {
  return body.replace(/\]\(([^)#\s]+\.md)((#[^\s)]*)?)\)/g, (match, target, anchor) => {
    if (/^[a-z]+:\/\//i.test(target)) return match;
    return `](${siteHref(relDir, target)}${anchor ?? ''})`;
  });
};

const extractTitle = (body) => {
  const match = body.match(/^#\s+(.+)\r?\n/);
  return match ? match[1].trim() : null;
};

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '.obsidian' ? [] : walk(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });

let count = 0;
const skipped = [];

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

for (const file of walk(SRC)) {
  const raw = readFileSync(file, 'utf8');
  const rel = relative(SRC, file).split(/[/\\]/).join('/');
  const relDir = posix.dirname(rel) === '.' ? '' : posix.dirname(rel);

  const title = extractTitle(raw);
  let body = title ? raw.replace(/^#\s+.+\r?\n/, '') : raw;
  body = rewriteLinks(body, relDir);
  body = body.replace(/\r\n/g, '\n').trimEnd() + '\n';

  const dest = join(OUT, destFor(rel));
  mkdirSync(dirname(dest), { recursive: true });
  const fileName = rel.split(/[/\\]/).pop();
  const numMatch = fileName.match(/^(\d+)-/);
  const order = posix.basename(destFor(rel), '.md') === 'index' ? 0 : numMatch ? parseInt(numMatch[1], 10) : null;
  let fm = title ? `---\ntitle: ${JSON.stringify(title)}\n` : '---\n';
  if (order !== null) fm += `sidebar:\n  order: ${order}\n`;
  fm += '---\n\n';
  writeFileSync(dest, fm + body);
  count++;
  if (!title) skipped.push(rel);
}

console.log(`ported ${count} pages into src/content/docs`);
if (skipped.length) console.log(`pages without an H1 title (no frontmatter title written):\n  ${skipped.join('\n  ')}`);
