# loopctl-site

The website for [loopctl](https://github.com/dch-labs/loopctl) — a landing page
and the full knowledge base, served at **https://loopctl.rs** via GitHub Pages.

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build)
(the docs engine behind the knowledge base), themed as an editorial "printing
house": paper and ink, Fraunces for display, Newsreader for text, JetBrains Mono
for code, a light **paper** and dark **dim** mode.

## Commands

| Command | What it does |
|---|---|
| `npm install` | install dependencies |
| `npm run dev` | dev server at `localhost:4321` |
| `npm run build` | static build into `dist/` (search index included) |
| `npm run preview` | serve the production build locally |
| `npm run port:kb` | re-port the knowledge base markdown (see below) |

## Content pipeline

The knowledge base markdown lives in this repository under `knowledge-base/` —
it is the source of truth for the *words*; this repo owns the presentation.
The pages under `src/content/docs/` are generated from it and committed, so
the site builds anywhere without extra steps.

`npm run port:kb` re-runs the port (`scripts/port-kb.mjs`):

- strips numeric filename prefixes and folder numbering into clean URLs
  (`02-engine/06-compaction.md` → `/engine/compaction/`),
- extracts each page's `# Heading` into frontmatter `title`,
- adds `sidebar.order` from the numeric prefixes so reading order survives,
- rewrites relative `.md` links into site-absolute URLs,
- maps folder `README.md` files to section index pages.

Ported output is committed, so the site builds standalone.

### Workflow for a content change

1. Write or edit markdown anywhere under `knowledge-base/` (any folder, any
   depth).
2. Run `npm run port:kb` — it regenerates `src/content/docs/` (titles come from
   `#` headings, reading order from `NN-` filename prefixes, relative `.md`
   links are rewritten, and a folder's `README.md` becomes its index page).
3. For a brand-new section only: add one sidebar entry in
   `astro.config.mjs`.
4. Commit both the source and the regenerated `src/content/docs/`, push — CI
   deploys.

## Deployment

GitHub Actions builds and deploys on every push to `main`
(`.github/workflows/deploy.yml`). One-time setup in GitHub:

1. Push this repository to `dch-labs/loopctl-site`.
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. For https://loopctl.rs: add the custom domain in Settings → Pages (the
   `public/CNAME` file is already in the build) and create the DNS records
   GitHub shows you (ALIAS/AAAA for the apex, CNAME for `www`).

The Starlight search index is built at deploy time by Pagefind — no external
service involved.
