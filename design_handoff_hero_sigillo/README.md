# Handoff: Hero "Il sigillo si solleva" (1d, bronzo patinato)

Riferimento visivo: `Baratto Hero Opzioni.dc.html` → opzioni **1d** (desktop 1440×900) e **1d Mobile** (390×844). Implementazione di riferimento del 3D: `seal-reference.js`, da portare solo per la modalità `lift` con finitura `bronze`. Le altre finiture e la modalità `solo` si possono scartare.

Sostituisce la hero attuale: niente più foto del manichino né wordmark `B A R A T T O 1948` nella hero.

## 1. Contenuti (`home.json › hero`)
- `image.src`: `../../assets/images/founder.jpg` (1800×1314, lo stesso file già usato in Heritage).
- `image.alt`: "Banco di lavoro della sartoria con il timbro Baratto 1948 sulla tela"
- `kicker`, `title`, `tagline`: invariati.
- Il logo per il rilievo 3D è `src/assets/brand/logo.png` (1024², con alpha), importato direttamente e non messo nel CMS.
- Schema/CMS: nessun campo nuovo.

## 2. Markup (`Hero.astro`)
```
section#top.hero[data-cover]
  .inner[data-cover-inner]
    .frame[data-seal-frame]            ← box "cover" della foto, a proporzioni fisse 1800/1314
      <Img .hero-img>                   ← width/height 100%, SENZA object-fit (il box è già in proporzione)
      .seal-shadow[data-seal-shadow]
      .seal-host[data-seal-host]        ← il canvas WebGL va qui
    .shade
    .content                            ← kicker + h1 a sinistra, tagline a destra
```
- Togliere `<Wordmark>` dalla hero; resta in Contact se è ancora usato lì.
- Togliere lo shader liquid sulla hero: in `main.ts` eliminare `liquid(heroImg, heroHost, { hero: true … })`, e `data-hero-host` non serve più. Il liquid distorcerebbe il timbro stampato e lo farebbe uscire di registro rispetto al sigillo 3D.
- Togliere `transform: scale(1.1)` dalla `.hero-img`.

### Posizioni (in % della `.frame`, derivate dalla foto)
Nel file, il timbro stampato ha centro a (900, 762) px e diametro 376 px.
| Elemento | Valori |
|---|---|
| `.frame` desktop/landscape (vw/vh ≥ 1800/1314) | `left:0; top:50%; width:100%; aspect-ratio:1800/1314; transform:translateY(-50%)` |
| `.frame` portrait/stretto | `left:50%; top:46.7%; height:106.7%; aspect-ratio:1800/1314; transform:translate(-50%,-50%)` (il timbro sale nella metà alta e non tocca il testo) |
| `transform-origin` della frame | `50% 58%` |
| `.seal-host` | `left:24.93%; top:23.65%; width:50.13%; aspect-ratio:1` (quadrato 2.4× il diametro del timbro, centrato sul timbro) |
| `.seal-shadow` | `left:50%; top:58%; width:21%; aspect-ratio:1; border-radius:50%; background:radial-gradient(closest-side, rgba(20,12,6,.75) 55%, rgba(20,12,6,0) 100%); opacity:0` |
| `.hero-img` | `filter: brightness(.86)` |

Lo switch landscape/portrait si può fare con `@media (max-aspect-ratio: 1800/1314)`.

### Sfumature (`.shade`)
- Desktop: `radial-gradient(110% 85% at 50% 55%, rgba(12,11,10,0) 50%, rgba(12,11,10,.55) 100%), linear-gradient(180deg, rgba(12,11,10,.6) 0%, rgba(12,11,10,0) 22%, rgba(12,11,10,0) 62%, rgba(12,11,10,.92) 100%)`
- Mobile: `radial-gradient(120% 70% at 50% 45%, rgba(12,11,10,0) 45%, rgba(12,11,10,.5) 100%), linear-gradient(180deg, rgba(12,11,10,.55) 0%, rgba(12,11,10,0) 16%, rgba(12,11,10,0) 64%, rgba(12,11,10,.94) 86%)`

### Testo
- Desktop: blocco in basso a sinistra (`bottom: 52px` a 1440, cioè `clamp(28px,3.6vw,56px)`), gap 14px. H1 a 64px su 1440×900 → `clamp(2.75rem, min(4.4vw, 7.1svh), 5rem)`, line-height 1.02. Tagline in basso a destra: `var(--fs-quote)` italic, `margin-bottom: 8px`.
- Mobile: blocco impilato `left/right: 20px; bottom: 36px + safe-area`, gap 12px. Kicker 11px, H1 44px, tagline **visibile** (20px italic, `margin-top: 4px`); oggi è nascosta sotto i 760px.

### Header
Durante la hero il timbro fa da logo, quindi `.hdr-logo` ha `opacity:0` e compare (`transition: opacity .6s`) quando la cover inizia a ridursi (stesso trigger di `scroll-fx.ts cover()`, p > 0.15). Consiglio una classe `is-past-hero` su `header`. Nel mockup mobile a sinistra c'è "Contatti" (link `#contatti`, 11px/600, tracking .2em, altezza 44px) al posto del logo; è opzionale e si può anche lasciare vuoto.

## 3. Timeline
`t` = secondi da quando `runIntro()` si risolve (o dal boot, se l'intro è disattivata). Easing `smoother(x) = x³(x(6x−15)+10)`.
| Cosa | Valore |
|---|---|
| Apparizione sigillo | `f = smoother(clamp((t − 0.6) / 2.6))` → opacity dei materiali |
| Sollevamento | `lr = clamp((t − 1.8) / 5.8)`; `l = smoother(0.35·smoother(lr) + 0.65·(1 − (1 − lr)³))` |
| Traslazione | `coin.z = 2.31·l`, cioè **+18%** di dimensione apparente a riposo (camera a 15.153) |
| Rotazione | `rotX = l·(−0.34 + 0.05·sin(0.4t) + 0.22·my)`, `rotY = l·(0.2 + 0.08·sin(0.3t) + 0.3·mx)` |
| Ombra | `opacity = 0.8·l`; `transform: translate(-50%,-50%) translate(5l%, 11l%) scale(1 + 0.15l)` |
| Ken Burns frame | `scale(1.12) → scale(1)`, 8 s, `cubic-bezier(.16,1,.3,1)`, parte a t=0 (la foto e il sigillo zoomano insieme perché il canvas è dentro la frame) |
| Testo (`data-line`/`data-fade`, `--d`) | kicker 4200 ms · h1 riga 1 4350 · riga 2 4500 · tagline 4750 |
| Puntatore | `mx,my ∈ [−1,1]` rispetto alla hero, lerp 0.05/frame. Mobile: `deviceorientation`, `(gamma−g0)/20`, `(beta−b0)/20` rispetto alla prima lettura; su iOS serve `DeviceOrientationEvent.requestPermission()` al primo tocco |
| Luce | la key light segue il puntatore: `x = 0.6 + 2.4·mx`, `y = 3 − 1.5·my` |

## 4. Scena 3D (vedi `seal-reference.js`)
- Renderer: `alpha:true`, antialias, DPR ≤ 2, `SRGBColorSpace`, `ACESFilmicToneMapping`, exposure 1.05, clear trasparente.
- Camera: `PerspectiveCamera(18°)`, `z = 2.4 / tan(9°) = 15.153`. Con il sigillo a z=0 il diametro coincide con il timbro stampato.
- Geometria (`coinParts`): logo alpha a 1024², blur 2.2 px → heightmap. `PlaneGeometry(2,2,440,440)`, `z = T/2 + R·alpha` con `T=0.14`, `R=0.036`; si scartano i triangoli con centroide fuori da r=1, poi `computeVertexNormals()`. Bordo `CylinderGeometry(1.006,1.006,T+R,180,1,true)` ruotato di 90° su x, `z = R/2`; retro `CircleGeometry(1.006,180)` a `z = −T/2`.
- Materiale **bronzo patinato**: `MeshStandardMaterial({ map: colorMap('bronze'), metalness:.25, roughness:.88, bumpMap: bumpMap('metal'), bumpScale:.5, envMapIntensity:.3, transparent:true })`; bordo e retro uguali con roughness .91. `colorMap('bronze')` a 512²: base `#5c4a32`, patina `#66705a` dove `fbm(u·11,v·11)` > .52 (max 70%, solo sul fondo), lettere schiarite verso `#96774b` (usura, 85%), shading `0.9 + 0.2·fbm(u·5,v·5)`.
- Luci: `DirectionalLight(#ffe4bd, 2.8)` a (0.6, 3, 4) + `AmbientLight(#2a2018, .6)`. Environment: PMREM da una mini-scena (`envFor`), con 5 pannelli emissivi caldi.
- Il rendering si ferma quando la hero è fuori viewport (IntersectionObserver) o quando la cover è completamente sbiadita.

## 5. Fallback e performance
- `three` come dipendenza npm, import dinamico in un nuovo `src/scripts/gl/seal.ts` **dopo** `runIntro()`. Circa 130 KB gz: è l'unica eccezione al "WebGL scritto a mano" (§13 di ARCHITECTURE). In alternativa si può portare a WebGL raw: la geometria è statica e l'unico shader è un PBR semplice.
- Niente WebGL o errore: resta la foto con il timbro stampato, che funziona già da sola.
- `prefers-reduced-motion`: nessun Ken Burns; sigillo subito in posa finale (`f = l = 1`), senza oscillazione; testo senza ritardi.
- La foto resta l'elemento LCP (`priority`); il canvas le si sovrappone soltanto.

## 6. Contratto `data-*` (ARCHITECTURE.md §6)
- **Aggiungere**: `data-seal-frame`, `data-seal-host`, `data-seal-shadow` | Hero | `gl/seal.ts` | sigillo in bronzo 3D registrato sul timbro della foto; appare, si solleva (+18%), segue puntatore/inclinazione; l'ombra lo segue.
- **Rimuovere**: la riga `data-hero-host` + `.hero-img` (liquid hero mode) e, nella riga Wordmark/§5, il riferimento alla Hero.
- §5 riga 01 Hero: "sticky, `[data-cover]` scale/fade on scroll, sigillo 3D (`gl/seal.ts`) sul timbro della foto founder.jpg".
- §9: aggiungere `gl/seal.ts` nella tabella WebGL.
