# Baratto 1948 — sito

One-page site for Baratto 1948 Sartoria Artigianale, implemented from the Claude Design file
`Baratto Home v6.dc.html`. Static [Astro](https://astro.build) build, hosted on GitHub Pages,
content editable through Decap CMS (prepared, not yet switched on).

```
npm install
npm run dev        # http://localhost:4321
npm run build      # → dist/
npm run preview    # serve dist/
npm run check      # type + content-schema check
```

How it works inside (boot sequence, animation loop, `data-*` contract, content model, design deltas):
see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Structure

```
src/
  content/                 ← ALL editable texts + image references (CMS writes here)
    pages/home.json
    settings/site.json     ← brand, contacts, address, P.IVA, intro on/off
  content.config.ts        ← schema: a bad edit fails the build instead of breaking the page
  assets/images/           ← source photos (optimized at build: AVIF + WebP, responsive widths)
  assets/brand/logo.png    ← official logo (cream on transparent)
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
.github/workflows/deploy.yml ← build + deploy to GitHub Pages on every push to main
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
- **Collaudo is `noindex`.** At launch: connect the custom domain in GitHub → Settings → Pages
  (the workflow then builds for the domain root automatically), add the repo variable
  `INDEXABLE=true` (Settings → Secrets and variables → Actions → Variables) and re-run the deploy.

## Deploy (GitHub Pages)
Every push to `main` builds and deploys via `.github/workflows/deploy.yml`
(also runnable by hand from the Actions tab). Collaudo: https://giuseppefigliuolo.github.io/baratto1948-site/

The site lives under `/baratto1948-site/` on github.io: the workflow passes `SITE_URL` and
`BASE_PATH` from `actions/configure-pages`, so every internal URL must go through
`import.meta.env.BASE_URL` / `src/lib/url.ts`, never a hard-coded `/…`.
GitHub Pages can't set custom HTTP headers: long-cache for `/_astro/*` and the security
headers from the old Netlify setup are gone (move behind Cloudflare if they're needed).

## Turning on the CMS (Decap)
Try it locally now, no account needed:
```
npm run cms     # terminal 1 (local Decap proxy)
npm run dev     # terminal 2 → http://localhost:4321/admin/
```
Online editing for the client:
1. GitHub Pages can't run the OAuth handshake, so deploy a small OAuth proxy
   (e.g. [decap-proxy](https://github.com/sterlingwes/decap-proxy) on Cloudflare Workers, free).
2. Create a GitHub OAuth app whose callback points to that proxy.
3. In `public/admin/config.yml` set `backend.base_url` to the proxy URL (`repo` is already set).
4. Editors log in at `https://<site>/admin/` with GitHub; each save is a commit → auto-deploy.

## Adding English later
Add `'en'` to `i18n.locales` in `astro.config.mjs`, create `src/content/pages/home.en.json`
and `src/pages/en/index.astro`, and extend the `hreflang` links in `Seo.astro`.

## Open items
- Replace placeholder images (see `src/assets/images/`, 17 of 20 are temporary crops) and the
  logo with the originals from the Claude Design project export.
- Street address, opening hours, P.IVA (required by Italian law on business sites) → `site.json`.
- Privacy/cookie policy page (no cookies or trackers are used today).
