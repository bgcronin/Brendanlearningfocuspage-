# Porting brief — Phase 0 inventory (Focus Vision website)

Instructions for a Claude session anchored on the PRODUCTION repo `bnrio/focusvision.com.au`.
(Netlify builds the live site focusvision.com.au from its `master` branch — treat it as live-site
source and make NO changes to it in this phase.)

## Mission

**Phase 0 — read-only inventory. Explicitly: NO branches, NO commits, NO pushes, NO pull
requests in this phase.** Compare production against this sandbox repo and produce a porting
inventory that the owner (Brendan, a non-developer) and his professional developer can read
and approve.

## Background

This sandbox repo (`bgcronin/Brendanlearningfocuspage-`, public, branch `main`) was seeded
2026-07-03 (commit `06fb3dc` "Brendan learning github and claude") as a copy of the production
site's files WITHOUT shared git history, then diverged both ways.

Sandbox-side analysis is ALREADY DONE — 48 changed paths since seed (excluding
`focus-cpd-portal/`), from 4 commits:

- `1980b01` + `3f9ce50` + `5e1f971` — Refractive Outcomes Analyzer overhaul: analyzer app
  `public/refractive-outcomes-analyzer/index.html` + xlsx templates + page
  `src/pages/free-refractive-outcomes-analyzer.astro`. NOTE: production already contains an
  OLDER analyzer version, so this is an upgrade-in-place, not an addition. The sandbox also
  DELETED `public/refractive-outcomes-analyzer/_old.html`.
- `dd481f6` — 16-file SEO/AI-search sweep: internal links, E-E-A-T signals, layouts
  (BaseLayout/BlogPostLayout/TreatmentLayout), `src/utils/seo.ts`, Navigation, Footer, several
  blog `.mdx` posts, authors, `_headers`, `_redirects`, `llms.txt`, `astro.config.mjs`,
  `config.ts`.

Infra diffs already verified safe/additive: `_redirects` only ADDS two analyser→analyzer
spelling redirects; `_headers` fixes a missing leading slash on the `_astro` cache rule;
`astro.config.mjs` adds the analyzer to the sitemap via `customPages` — fold these into
Phase 1.

New pages added by sandbox: `src/pages/cairsplan.astro` (links to https://cairsplan.com —
live, safe), `src/pages/cpd.astro` (links to https://cpd.focusvision.com.au — DOMAIN NOT YET
LIVE; flag as a sequencing question), plus new blog post
`src/content/blog/how-to-audit-your-cataract-surgery-refractive-outcomes.mdx` with images
under `src/assets/images/blog/how-to-audit-your-cataract-surgery-refractive-outcomes/` and
`public/refractive-outcomes-analyzer/og-image.png`.

The sandbox also contains `focus-cpd-portal/` — a separate CPD-portal app already deployed
elsewhere; OUT of scope, list as do-not-port.

## Your job — the production side of the comparison

1. You already have production checked out; clone this sandbox next to it if you have not
   already: `git clone --branch main https://github.com/bgcronin/Brendanlearningfocuspage-.git`
   (public, no credentials needed).
2. Diff sandbox `main` vs production `master` file-by-file, EXCLUDING: `.git`, `node_modules`,
   `dist`, `.netlify`, `focus-cpd-portal/`, `*.code-workspace`, `.env*`, OS junk, and this
   `PORTING-BRIEF.md` file itself. Report `package.json`/`package-lock.json` differences at
   dependency-name level only.
3. Build four buckets:
   - **A. ADDITIONS** — files only in sandbox (expected: the new pages/blog/images above).
     Flag any nav/sitemap/config wiring they need to be reachable.
   - **B. MODIFIED** — files differing between the repos. For EACH, use `git log` on the
     production side (history since 2026-07-03) to classify: **B1** = production has NOT
     touched it since the seed date (sandbox change ports cleanly); **B2** = production ALSO
     changed it after 2026-07-03 (true conflict — likely among blog `.mdx` files edited via
     Keystatic). One line per file in plain English on what the sandbox changed; for B2 add
     what production changed and when.
   - **C. PRODUCTION-ONLY** — files existing only in production (newer Keystatic content
     etc.): count, a few dated examples, mark the entire bucket DO-NOT-TOUCH.
   - **D. DO-NOT-PORT** — sandbox-only infrastructure: `focus-cpd-portal/`, workspace files,
     sandbox-specific README/netlify.toml/config divergence, this brief, and the `_old.html`
     deletion decision.
4. Propose:
   - **PHASE 1 PR** — analyzer upgrade-in-place + new blog post + images + the three safe
     infra tweaks; note old-vs-new analyzer will be comparable in the deploy preview.
   - **PHASE 2 candidates** — B1 SEO/site updates grouped into 1–3 small PRs; keep
     `cpd.astro` OUT until its domain question is resolved — list it under open questions.
   - **OPEN QUESTIONS** — every B2 conflict + the cpd.focusvision.com.au domain sequencing,
     phrased so a non-developer can rule on each.
5. Deliver the report by creating ONE GitHub issue on `bnrio/focusvision.com.au` titled
   "Porting inventory — analyzer + SEO from sandbox (Phase 0, read-only, no changes made)".
   Audience: non-developer owner first, developer second — plain English up top (summary
   under ~30 lines), full file lists in collapsible `<details>` sections. Use the GitHub MCP
   tools (load via ToolSearch, e.g. `issue_write`); the `gh` CLI is unavailable. Do NOT open
   PRs, do NOT push.
6. End your final message with the issue URL plus a 10-line executive summary.

## Constraints

Read-only toward production in this phase; the ONLY write anywhere is that single GitHub
issue. If issue creation is denied, print the full report as your final message instead and
retitle your session "Phase 0 report ready (in transcript)".
