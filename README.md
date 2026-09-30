# Baratto 1948 — sito

One-page site for Baratto 1948 Sartoria Artigianale, implemented from the Claude Design file
`Baratto Home v6.dc.html`. Static [Astro](https://astro.build) build, hosted on Netlify,
content editable through Decap CMS (prepared, not yet switched on).

```
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview    # serve dist/
npm run check      # type + content-schema check
```

## Structure

```
src/
  content/                 ← ALL editable texts + image references (CMS writes here)
    pages/home.json
    settings/site.json     ← brand, contacts, address, P.IVA, intro on/off
  content.config.ts        ← schema: a bad edit fails the build instead of breaking the page
  assets/images/           ← source photos (optimized at build: AVIF + WebP, responsive widths)
  assets/brand/logo.svg    ← TEMPORARY vector seal, replace with the official logo
  components/
    sections/*.astro       ← one file per page section, scoped CSS next to markup
    ui/                    ← Img (responsive <picture>), Lines (masked headings), Wordmark
    Seo.astro              ← meta, Open Graph, canonical, hreflang, JSON-LD graph
    Header.astro, Intro.astro
  layouts/Base.astro       ← <head>, fonts, motion flag
  pages/
    index.astro
    robots.txt.ts          ← blocks crawlers unless INDEXABLE=true
    llms.txt.ts            ← plain-text summary for AI assistants (GEO)
  scripts/
    main.ts                ← entry, load order
    core/                  ← single rAF loop (read→write phases), Lenis, visibility, helpers
    features/              ← intro, reveal, scroll-fx, pile, collection, marquee, cursor, menu
    gl/                    ← WebGL effects (hero liquid, hover liquid, Atelier gallery)
  styles/global.css        ← tokens, primitives, motion initial states
public/admin/              ← Decap CMS (config.yml)
netlify.toml               ← build, cache + security headers, INDEXABLE flag
```

### Text conventions (CMS)
- `*parola*` → italic accent · a newline → line break
- Headings are lists of lines (each line slides in on its own).
- In "phrases" lists the last item is shown in gold.

## Performance notes
- Zero framework runtime: HTML + inlined CSS; one ~10 KB (gzip) script incl. smooth scroll.
- three.js (~150 KB) replaced by ~5 KB of hand-written WebGL, lazy-loaded when the page is idle,
  skipped on Save-Data / low-memory devices and with `prefers-reduced-motion`.
- One animation loop for everything. Layout is measured on resize only; each effect runs only
  while its section is near the viewport and only when scroll changed. Only `transform`,
  `opacity`, `clip-path`, `filter` are animated.
- Hero image: preloaded with `fetchpriority=high`; everything else lazy with explicit sizes (no CLS).
- Fonts self-hosted by Astro (Instrument Serif, Hanken Grotesk), subset, with metric-matched fallbacks.
- Intro plays once per session (~1.6 s); the hero renders underneath so LCP isn't delayed.
- Without JS or with reduced motion every section degrades to a static, fully readable layout.

## SEO / GEO
- Semantic sections with one `h1`, ordered `h2/h3`, process as an ordered list, `address` for contacts.
- JSON-LD graph: `ClothingStore`/`Organization` (founder, founding date/place, contacts, offers),
  `WebSite`, `WebPage`. Built from `settings/site.json` — fill in street address and P.IVA there.
- `/llms.txt`, `/sitemap-index.xml`, `/robots.txt`, canonical + `hreflang` (IT now, EN-ready).
- **Collaudo is `noindex`.** At launch set `INDEXABLE=true` and `SITE_URL=https://www.baratto1948.com`
  in Netlify → Site configuration → Environment variables, then redeploy.

## Deploy (Netlify)
Manual deploy from this folder: `npx netlify-cli deploy --build --prod`.
Recommended next step: push to GitHub and link the repo in Netlify so every push deploys
(and each branch/PR gets its own preview URL).

## Turning on the CMS (Decap)
Try it locally now, no account needed:
```
npm run cms     # terminal 1 (local Decap proxy)
npm run dev     # terminal 2 → http://localhost:4321/admin/
```
Online editing for the client:
1. Push this folder to a GitHub repo and link it in Netlify.
2. In `public/admin/config.yml` set `backend.repo: <owner>/<repo>`.
3. Netlify → Site configuration → Access & security → OAuth → Install provider → GitHub
   (create a GitHub OAuth app with callback `https://api.netlify.com/auth/done`).
4. Editors log in at `https://<site>/admin/` with GitHub; each save is a commit → auto-deploy.

## Adding English later
Add `'en'` to `i18n.locales` in `astro.config.mjs`, create `src/content/pages/home.en.json`
and `src/pages/en/index.astro`, and extend the `hreflang` links in `Seo.astro`.

## Open items
- Replace placeholder images (see `src/assets/images/`, 17 of 20 are temporary crops) and the
  logo with the originals from the Claude Design project export.
- Street address, opening hours, P.IVA (required by Italian law on business sites) → `site.json`.
- Privacy/cookie policy page (no cookies or trackers are used today).
