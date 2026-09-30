# Baratto 1948 — architecture

Developer guide to how the site is built and how its parts talk to each other.
For setup, deploy and CMS activation see the [README](../README.md).

- [1. Where it comes from](#1-where-it-comes-from)
- [2. Repository layout](#2-repository-layout)
- [3. Build-time pipeline](#3-build-time-pipeline)
- [4. Runtime boot sequence](#4-runtime-boot-sequence)
- [5. Page composition](#5-page-composition)
- [6. The `data-*` contract](#6-the-data--contract)
- [7. Animation loop](#7-animation-loop)
- [8. Scrolling and anchors](#8-scrolling-and-anchors)
- [9. WebGL effects](#9-webgl-effects)
- [10. Content model and CMS](#10-content-model-and-cms)
- [11. Images](#11-images)
- [12. SEO / GEO outputs](#12-seo--geo-outputs)
- [13. Design vs. implementation](#13-design-vs-implementation)
- [14. Recipes](#14-recipes)
- [15. Gotchas](#15-gotchas)

---

## 1. Where it comes from

The page implements `Baratto Home v6.dc.html` from the Claude Design project
[`1db41e7f-…`](https://claude.ai/design/p/1db41e7f-fd79-4db4-9ea2-4eeabed7929b?file=Baratto+Home+v6.dc.html).
That file is one long template made of inline styles, `{{ }}` bindings, `<sc-if>`/`<sc-for>`
and a `Component` class. It pulls in `baratto-motion-v4.js` (reveals, cursor, intro, Lenis)
and `baratto-three.js` (three.js hero and gallery).

The same design project also holds:

| Path in design project | What it is |
|---|---|
| `Baratto Home v4/v5.dc.html`, `Baratto Landing Cinematico*.dc.html`, `Baratto Landing Editoriale.dc.html` | Earlier explorations. Not used. |
| `assets/g/*.jpg` | Photos used by v6. Same file names as `src/assets/images/`. |
| `assets/g/logow.png`, `assets/g/logo.jpg`, `assets/logo.jpg` | Official logo (white and dark). The site still uses a temporary SVG. |
| `assets/hq/*.jpg` | Higher-resolution photos (book, buttons, fitting, heritage, tape…). |
| `uploads/*_n.jpg` | Raw Instagram exports. Same files as `../source-photos/` next to this repo. |
| `_ds/waterstream-design-system-…` | An unrelated design system attached to the project. Ignore it. |

## 2. Repository layout

```
baratto/
  source-photos/            raw client photos (Instagram exports), not used by the build
  site/                     ← git repo (github.com/giuseppefigliuolo/baratto1948-site)
    astro.config.mjs        site URL, fonts, image breakpoints, i18n (it only)
    .github/workflows/deploy.yml  build + GitHub Pages deploy, INDEXABLE flag
    public/admin/           Decap CMS (index.html + config.yml)
    src/
      content/              home.json + site.json  ← every editable string and image
      content.config.ts     Zod schema for both files
      lib/                  content loaders, rich-text helper
      layouts/Base.astro    <html>, <head>, motion flag script, fonts, main.ts
      pages/                index.astro, robots.txt.ts, llms.txt.ts
      components/           Header, Intro, Seo, sections/*, ui/*
      scripts/              client JS: core/, features/, gl/
      styles/global.css     tokens, primitives, motion initial states, cursor
    docs/                   this file
```

## 3. Build-time pipeline

```
src/content/pages/home.json ─┐
src/content/settings/site.json ─┤→ content.config.ts (Zod + image())  → lib/content.ts getHome()/getSettings()
                                                                        │
                    pages/index.astro ← components/sections/*.astro ←───┘
                          │                     │
                          │                     └→ astro:assets: AVIF/WebP srcsets, fixed-size textures
                          └→ dist/index.html (CSS inlined, HTML compressed) + one hashed JS bundle
pages/robots.txt.ts, pages/llms.txt.ts → text files built from the same content
@astrojs/sitemap                        → sitemap-index.xml
```

- **Static output only.** No server code runs on GitHub Pages. `process.env.INDEXABLE`, `SITE_URL` and `BASE_PATH`
  are read **at build time**, so changing them requires a redeploy.
- `build.inlineStylesheets: 'always'`: all component CSS ends up inline in `<head>`.
- A bad content edit (missing field, wrong list length, image path that doesn't exist) fails
  `astro build` / `astro check` rather than shipping a broken page.

## 4. Runtime boot sequence

1. **Inline `<head>` script** ([Base.astro](../src/layouts/Base.astro)) runs before first paint:
   - with `prefers-reduced-motion: reduce` it stops, and the page stays static;
   - otherwise it adds `html.m` (motion on);
   - if `data-intro="1"` (from `site.json → intro.enabled`) and `sessionStorage['b48-intro']` is unset,
     it adds `html.intro` and sets a 6 s failsafe that removes it.
2. **CSS** reacts to those classes. `.m [data-line]`, `.m [data-fade]` and `.m [data-clip]` start hidden, and
   sticky and scroll-driven layouts (Quote 300vh, Collection 320vh) switch on only under `.m`.
   Without `.m` every section is a normal readable block, and Collection becomes a native horizontal scroller.
3. **`scripts/main.ts`** (one module bundle, deferred):
   - always: `initSmooth(motion)` (click-to-anchor handling; Lenis only with motion) and `initMenu()`;
   - with motion: `runIntro()` returns a promise, then `initReveal(ready)` (reveals wait for the intro),
     `initScrollFx`, `initPile`, `initCollection`, `initMarquee`, `initCursor` (fine pointer only),
     then `start()` starts the single rAF loop;
   - after the intro, on idle: `loadGL()` checks device capability and dynamically imports `gl/liquid` + `gl/atelier`.

### `<html>` state classes

| Class / attr | Set by | Meaning |
|---|---|---|
| `m` | head script | motion enabled; gates all animated initial states |
| `intro` | head script, removed by `features/intro.ts` | intro overlay visible, page scroll locked |
| `menu-open` | `features/menu.ts` | mobile menu open |
| `data-intro="1\|0"` | Base.astro | intro enabled in CMS |
| `style.overflow=hidden` | `lockScroll()` in `core/smooth.ts` | scroll locked (intro, menu); also stops Lenis |

## 5. Page composition

Order in [index.astro](../src/pages/index.astro). Everything after Hero sits inside `.sheet`, which slides over the sticky hero.

| # | Component | Content key | Anchor | Motion behaviour |
|---|---|---|---|---|
| — | `Intro.astro` | `settings.intro`, 6 images from home | — | image flicker, counter 0→100, frame opens to full hero (`features/intro.ts`) |
| — | `Header.astro` | `settings` | — | `mix-blend-mode: difference`; progress bar; mobile burger → fullscreen menu |
| 01 | `sections/Hero.astro` | `hero` | `#top` | sticky, `[data-cover]` scale/fade on scroll, WebGL liquid on photo, wordmark letters |
| 02 | `sections/Manifesto.astro` | `manifesto` | — | 3 masked decor images parallax, `[data-phrases]` blur→focus |
| 03 | `sections/Heritage.astro` | `heritage` | `#radici` | line reveals, clip wipes, hover liquid on both photos |
| 04 | `sections/Today.astro` | `today` | — | `[data-phrases]` |
| 05 | `sections/Quote.astro` | `quote` | — | `[data-zoomreveal]`: 300vh sticky, clip-path opens to full-bleed, quote fades in |
| 06 | `sections/Process.astro` | `process` | `#processo` | `<ol>` of sticky cards, `[data-pile]` tilt-in / lean-back stack |
| 07 | `sections/Details.astro` | `details` | — | clip wipe, parallax, hover liquid |
| 08 | `sections/Collection.astro` | `collection` | `#collezione`, `#giacca`, `#pantalone`, `#tessuti` | 320vh sticky; vertical scroll → horizontal track, velocity skew, counter, progress bar |
| 09 | `sections/Atelier.astro` | `atelier` | — | DOM list fallback replaced by curved draggable WebGL gallery |
| 10 | `sections/Marquee.astro` | `marquee` | — | infinite band; speed/direction follow scroll velocity |
| 11 | `sections/Contact.astro` | `contact` + `settings` | `#contatti` | parallax background, `<address>` cards, footer wordmark |

Shared UI:

- `ui/Img.astro` wraps `<Picture>` with AVIF + WebP output. It filters the width list to the source width, sets explicit dimensions,
  and passes `data-*`/`class` through to the `<img>`. `priority` sets eager + `fetchpriority=high`.
- `ui/Lines.astro` renders a heading as a list of `.mask > [data-line]` spans, staggered by `step` ms through `--d`.
- `ui/Wordmark.astro` renders the giant `B A R A T T O 1948` row, one `[data-line]` per letter (Hero and Contact).

## 6. The `data-*` contract

Markup and scripts are coupled only through these attributes. Rename one and you have to change both sides.

| Attribute | Placed in | Read by | Effect |
|---|---|---|---|
| `data-line`, `data-tilt` | Lines, Wordmark, Hero | `features/reveal.ts` + CSS | slide up (optionally tilted) out of `.mask`; the **parent** is observed |
| `data-fade` | many | `reveal.ts` + CSS | fade + rise |
| `data-clip` / `data-clip="c"` | Heritage, Details | `reveal.ts` + CSS | clip wipe from bottom / from centre; parent observed |
| `--d` (CSS var) | inline style | CSS transitions | per-element reveal delay |
| `data-speed`, `data-zoom` | images, decor layers | `scroll-fx.ts parallax()` | translateY ∝ distance from viewport centre; constant scale |
| `data-phrases` > `data-phrase` | Manifesto, Today | `scroll-fx.ts phrases()` | phrases un-blur one after another |
| `data-cover`, `data-cover-inner` | Hero | `scroll-fx.ts cover()` | hero shrinks, drops, fades, rounds corners |
| `data-progress` | Header | `scroll-fx.ts progress()` | top gold progress bar |
| `data-zoomreveal`, `data-zr-box/img/dim/text` | Quote | `scroll-fx.ts zoomReveal()` | clip-path inset → 0, quote appears |
| `data-pile="r,x,er,ex"`, `data-pile-dim`, `data-pile-img` | Process | `features/pile.ts` | resting rot/x, entry rot/x; dim + scale of covered card |
| `data-coll`, `data-coll-viewport/track/card/img/dim/body/bar/ctr`, `data-skew` | Collection | `features/collection.ts`, `core/smooth.ts` | horizontal scroll track; `data-skew` also marks anchorable chapters |
| `data-marquee` | Marquee | `features/marquee.ts` | must contain two identical halves (loops at `scrollWidth / 2`) |
| `data-cursor="Label"` | Collection card, Atelier host, `[data-gl]` hosts | `features/cursor.ts` | big labelled cursor |
| `data-magnetic` | Header pill | `cursor.ts` | follows pointer |
| `data-gl` | Heritage ×2, Details | `gl/liquid.ts` | hover "liquid fabric" shader |
| `data-hero-host` + `.hero-img` | Hero | `gl/liquid.ts` (hero mode) | always-on liquid shader, then hides the `<img>` |
| `data-atelier`, `data-items` (JSON), `data-atelier-fallback/title/count` | Atelier | `gl/atelier.ts` | WebGL gallery; hides fallback after first texture |
| `data-intro-el/frame/img/count/fade` | Intro | `features/intro.ts` | intro overlay |
| `data-menu`, `data-menu-toggle`, `data-menu-label`, `data-menu-link` | Header | `features/menu.ts` | menu; `data-menu-link` opts out of the global anchor handler |

## 7. Animation loop

[`core/loop.ts`](../src/scripts/core/loop.ts) runs **one** `requestAnimationFrame` loop for the whole page.

```ts
subscribe({ read(f) { /* layout reads only */ }, write(f) { /* style writes only */ } });
subscribe((f) => { /* write-only shorthand */ });
onMeasure(() => { /* cache offsets/sizes; runs now and after every resize */ });
```

Each tick:

1. `driver(now)`: Lenis advances the smooth scroll position.
2. `frame` is updated: `y`, `dy`, `vel` (lerped velocity used for skews), `dir`, `vw/vh`, and `changed`
   (true on scroll or after a remeasure).
3. Every subscriber's `read` runs, then every `write`, so layout is never interleaved with writes.

Conventions that keep the loop cheap:

- **Measure in `onMeasure`, not per frame.** `remeasure()` is triggered by `resize`, a `ResizeObserver`
  on `<body>` (content height changes), `document.fonts.ready` and `load`.
- **Return early** with `if (!f.changed) return;` for purely scroll-driven effects.
- **Gate by visibility** with `watch(el, margin)` from [`core/visible.ts`](../src/scripts/core/visible.ts),
  which gives you a `{ on }` flag backed by one shared IntersectionObserver per margin.
- **Write through `setStyle(el, prop, value)`**, which skips the DOM write when the value hasn't changed.
- Only animate `transform`, `opacity`, `clip-path` and `filter`.

Velocity-based effects (collection skew, marquee, atelier drift) deliberately run even when `changed` is false,
so they can ease back to rest.

## 8. Scrolling and anchors

[`core/smooth.ts`](../src/scripts/core/smooth.ts):

- Lenis (`lerp 0.085`, wheel only, `autoRaf: false`) is driven by the shared loop. Touch scrolling stays native.
- A single delegated click handler catches every `a[href^="#"]` (except `data-menu-link`) and calls `scrollToHash`.
- **Collection anchors** (`#giacca`, `#pantalone`, `#tessuti`) don't scroll to the element. They resolve to the
  vertical scroll position where that chapter is centred in the horizontal track:
  `top(section) + i / (n-1) * (sectionHeight - vh)`. Without motion, `scrollIntoView({inline:'center'})` is used instead.
- `lockScroll(true|false)` is shared by intro and menu.

The mobile menu closes first, waits 350 ms for the clip-path animation, and only then scrolls.

## 9. WebGL effects

Plain WebGL1 with no dependencies. Helpers live in [`gl/util.ts`](../src/scripts/gl/util.ts).

**Loaded only if** motion is on, the intro has finished, the browser is idle, `saveData` is off,
`deviceMemory >= 4` (when reported) and a WebGL context can be created. Otherwise the plain images stay.

| Module | Used on | Notes |
|---|---|---|
| `gl/liquid.ts` | hero (always alive, follows mouse, darkens and zooms on scroll); `img[data-gl]` (on hover on desktop, ambient drift on touch) | one small canvas per image, created lazily; draws only while visible and active; object-fit cover handled by `uC`/`uO` uniforms; chromatic split from scroll velocity |
| `gl/atelier.ts` | Atelier gallery | 24×24 grid per panel, bent along z; infinite wrap; drag (pointer), horizontal wheel, autoplay drift + scroll velocity; screen-space hover hit test; textures fetched from the 800 px WebP URLs in `data-items`, staggered 60 ms apart |

The DOM remains the source of truth. The hero `<img>` stays in the page (it's the LCP element) and is hidden only after the canvas has faded in.
The Atelier `<ul>` stays for SEO and no-JS, and is only set to `visibility: hidden`.

## 10. Content model and CMS

**Three places define the shape of the content, and they have to agree:**

1. [`src/content.config.ts`](../src/content.config.ts): Zod schema, the source of truth enforced at build.
2. [`public/admin/config.yml`](../public/admin/config.yml): Decap CMS fields, which mirror the schema by hand.
3. The section component that renders the field.

Fixed cardinalities are baked into the layout. Changing any of them needs code changes:

| Field | Constraint | Why |
|---|---|---|
| `process.steps` | exactly 4 | `PILE` array in `Process.astro` has 4 entries |
| `collection.chapters` | exactly 3, `id ∈ {giacca, pantalone, tessuti}` | anchors are hard-coded in `Header.astro` menu/nav |
| `manifesto.decor` | exactly 3 | three positioned `.decor` slots (`d1`–`d3`) |
| `atelier.gallery` | ≥ 3 | WebGL gallery bails out below 3 |
| `seo.title` / `seo.description` | ≤ 70 / ≤ 170 chars | SERP limits |

**Text conventions** ([`lib/rich.ts`](../src/lib/rich.ts)):

- `rich()` HTML-escapes everything, then turns `*x*` into `<em>x</em>` and `\n` into `<br>`. It is the only
  input to `set:html`, so editors can't inject markup.
- `plain()` strips the markup, for meta tags, JSON-LD and `llms.txt`.
- Heading fields are **arrays of lines**. Each line becomes its own masked reveal.
- In `phrases` arrays the **last** item is rendered in gold (`.accent`), and trailing spaces inside items are significant.
- Only some fields go through `rich()`: hero/heritage/process/details/atelier/contact titles (via `Lines`),
  `hero.title`, heritage `lead`s, manifesto/today `phrases` and `quote.text`. Everything else is plain text, so `*` shows literally.

**Hard-coded strings.** These don't come from content, so change them in code: header nav labels, "Contatti" pill,
"Fase NN / NN", "Scopri", "Telefono/Email/Web/Instagram" labels, the `data-cursor` labels, JSON-LD `knowsAbout`/`alternateName`,
and the prose skeleton of `llms.txt`.

Image paths in JSON are relative to the JSON file (`../../assets/images/x.jpg`). Decap writes them the same way
(`media_folder: src/assets/images`, `public_folder: ../../assets/images`).

## 11. Images

- Sources live in `src/assets/images/` and are processed by Astro/Sharp at build time. Global breakpoints are `480/768/1080/1440/1920`.
- `Img.astro` (for photos that are content) emits AVIF + WebP `<picture>` with lazy loading, `quality 68` and a per-use `sizes`.
- Fixed single renditions via `getImage()` where a srcset makes no sense:

| Where | Size | Why |
|---|---|---|
| `Intro.astro` frames | 360 w WebP q55 | flicker thumbnails, lazy, never fetched by returning visitors |
| `Manifesto.astro` decor | 480 w WebP q50 | masked, filtered, 32–42 % opacity |
| `Atelier.astro` textures | 800 w WebP q70 | WebGL panels are ≤ 400 css px |
| `Contact.astro` background | 1280 w WebP q45 | grayscale under an 82 % veil |
| `Seo.astro` OG image | 1200×630 JPG q78 | social cards |

- The last intro frame uses the hero's exact `srcset`, so it reuses the cached LCP file.
- `picture { display: contents }` means the `<picture>` wrapper has no box. `hostOf()` in `core/dom.ts` skips it
  to find the real layout container for parallax and WebGL.

## 12. SEO / GEO outputs

| Output | Source |
|---|---|
| `<title>`, description, canonical, `hreflang it` + `x-default`, OG/Twitter, `geo.*` | `components/Seo.astro` |
| `robots` meta | `noindex, nofollow` unless `INDEXABLE=true` at build |
| JSON-LD `@graph`: `ClothingStore`+`Organization`, `WebSite`, `WebPage` | `Seo.astro` from `site.json` + `home.json` (street, geo and vatID are added only when filled in) |
| `/robots.txt` | `pages/robots.txt.ts`: `Disallow: /` unless `INDEXABLE=true` |
| `/llms.txt` | `pages/llms.txt.ts`: Italian plain-text brand summary |
| `/sitemap-index.xml` | `@astrojs/sitemap` |
| `/admin/*` | meta noindex (GitHub Pages can't send headers) |

Semantics: one `h1` (hero), one `h2` per section, `h3` for step and chapter titles, `<ol>` for the process,
`<address>` for contacts, `<figure>/<blockquote>/<figcaption>` for the quote, and `lang="en"` on English strings.

## 13. Design vs. implementation

| Design v6 | Site |
|---|---|
| Inline styles, `{{ }}` bindings, React-like `Component` | Astro components with scoped CSS; zero framework runtime |
| `isMobile` = JS state `innerWidth < 760`, re-rendered on resize | CSS `@media (max-width: 759px)`; same 760 threshold in TS |
| `baratto-motion-v4.js` + Lenis 1.1.13 from unpkg | own modules in `src/scripts/`, `lenis` 1.3 from npm |
| `baratto-three.js` (three.js, ~150 KB) | hand-written WebGL in `src/scripts/gl/` (~5 KB) |
| Google Fonts `<link>` | Astro `fonts` API, self-hosted and subset, with metric fallbacks |
| Props `collezioneMotion` A/B, `cardStyle` A/B | **only A shipped** ("Parallasse morbida", "Editoriale"); B variants not ported |
| Props `intro`, `motion`, `smoothScroll`, `threeEffects`, `webglHover`, `cursor` | `intro` → `site.json`; `motion` → `prefers-reduced-motion`; the rest always on, gated by device capability |
| Text inline in template | `src/content/*.json`, editable through Decap |
| Collection card is `<a href="#">` | `<article>` with a stretched "Scopri" link to `#contatti` + screen-reader text |
| Logo `assets/g/logow.png` | **temporary** `src/assets/brand/logo.svg` |
| Footer "© Baratto 1948 · …" | current year + optional P.IVA |
| Intro preloads 10 full images | 6 × 360 px lazy thumbnails + hero srcset |
| Quote box markup has a single initial clip `inset(22% 34%)` | mobile starts at `inset(24% 14%)`, a wider window on narrow screens (CSS + `zoomReveal()`) |

## 14. Recipes

**Change copy or an image.** Edit `src/content/pages/home.json` or `settings/site.json` (or use `/admin`). Run `npm run check`.

**Add a field.** Add it to `content.config.ts`, then `public/admin/config.yml`, then the component, and fill it in `home.json`.
Leaving out the CMS step means editors can't see the field. Leaving out the JSON step fails the build.

**Add a section.**
1. Create `src/components/sections/Foo.astro` taking `{ home }`, with scoped `<style>`, `var(--gutter)` padding
   and `Lines` for the heading.
2. Add a `foo` object to the schema, CMS config and `home.json`.
3. Insert it into `.sheet` in `pages/index.astro`.
4. Reuse existing hooks (`data-fade`, `data-clip`, `data-speed`, `data-phrases`) before writing new JS.
5. If it needs an anchor, add it to `menuLinks` / `.hdr-nav` in `Header.astro`.

**Add a scroll effect.**
```ts
// src/scripts/features/foo.ts
export function initFoo() {
  const el = $('[data-foo]'); if (!el) return;
  const zone = watch(el, '10% 0px');
  let top = 0;
  onMeasure(() => { top = docTop(el); });
  subscribe((f) => {
    if (!zone.on || !f.changed) return;
    setStyle(el, 'transform', `translate3d(0,${((f.y - top) * 0.1).toFixed(1)}px,0)`);
  });
}
```
Call it inside `if (motion) { … }` in `main.ts`, before `start()`. Give its CSS initial state a `.m` prefix
so the page still reads correctly without motion.

**Go live.** Connect the custom domain in GitHub → Settings → Pages, set the repo variable `INDEXABLE=true`, re-run the deploy workflow.
Also update `site_url`/`display_url` in `public/admin/config.yml`.

## 15. Gotchas

- **The mobile breakpoint is duplicated.** `759px` appears in CSS media queries, and `760` in `core/dom.ts isMobile`,
  `features/pile.ts`, `scroll-fx.ts zoomReveal` and `features/menu.ts`. The Atelier gallery uses its own `host width < 700`.
- **Process card geometry lives in two places.** `PILE` in `Process.astro` feeds both the `data-pile` values (JS)
  and the `--r/--x/--t/--tm` CSS vars (static fallback and sticky tops). `pile.ts` reads the sticky `top`
  back through `getComputedStyle`.
- **The intro has three failsafes.** A JS guard (~4.1 s), a CSS fade animation at 5.6 s and the inline 6 s class removal.
  If you lengthen the intro, raise all three.
- **Reveals wait for the intro.** Elements that intersect during the intro are queued and shown when it ends.
- **The rAF loop never stops.** It runs every frame, but subscribers exit early, so idle frames cost little.
  Keep new subscribers cheap on `!f.changed`.
- **Marquee markup must be two identical halves.** The wrap point is `scrollWidth / 2`.
- **`Collection.astro` takes a `settings` prop it doesn't use.** Harmless.
- **Placeholders still to replace:** the logo SVG (the official one is in the design project at `assets/g/logow.png`),
  most photos in `src/assets/images/` (higher-res originals are in `assets/hq/` and `uploads/` of the design project),
  plus street address, P.IVA and hours in `site.json`.
- **CMS is not live.** `backend.repo` is `OWNER/baratto1948-site`. Only `npm run cms` (the local proxy) works today.
