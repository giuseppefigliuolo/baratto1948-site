# Handoff: 07 Dettagli: mobile "Respiro" (3a)

> **Prompt per Claude Code:** "Leggi `docs/handoff/dettagli-mobile/README.md` e sostituisci il ramo portrait/narrow della sezione 07 come descritto. Il desktop non va toccato."

## Overview
Solo mobile / portrait (`narrow = vw < vh * 1.05`). Il desktop "Colonna" è già implementato e resta invariato.

Oggi su mobile il video cresce a schermo pieno e le 4 righe compaiono centrate sopra. Con **3a Respiro**:
1. Il video parte come finestra 9:16 al centro. "La maestria" sta appena **sopra** il box e "nei dettagli." appena **sotto**.
2. Il box cresce fino a 100vw × 100vh e spinge le due metà verso i bordi (che si fermano a 96px dal bordo); intanto il video si scurisce.
3. A schermo pieno le due metà **si richiudono al centro**: "La maestria" / "nei dettagli." si uniscono attorno al 36% dell'altezza.
4. Sotto entrano *Ogni scelta,* / *una firma.* in oro, poi il body.

## About the design files
`Baratto Home v8.dc.html` (metodo `startColumn()`, ramo `if (narrow)`) e l'opzione **3a** in `Baratto Dettagli Opzioni.dc.html` sono riferimenti in HTML, non codice da copiare. Il video non è incluso: i file puntano a `assets/video/dettagli.mp4`; nel repo è già in `public/video/`.

## Fidelity
**Hi-fi.** Valori e timing sono definitivi. Il copy non cambia (`home.details.split`, `body`).

## File da toccare
- `src/scripts/features/scroll-fx.ts › column()`: sostituire il ramo `if (narrow) { … }`.
- `src/components/sections/Details.astro`: aggiornare il blocco `@media (max-aspect-ratio: 105/100)` (stato finale senza JS / reduced-motion) e l'altezza mobile.
- `docs/ARCHITECTURE.md`: aggiornare la descrizione di Details (§5) e la riga `data-column` (§6). Nessun nuovo `data-*`.

## Behavior: nuovo ramo `narrow` in `column()`
Il ramo ricalcola box e video (easing e timing diversi dal desktop), quindi va dopo i `setStyle` comuni e li sovrascrive.

```ts
if (narrow) {
  // Portrait "Respiro": video grows, title halves ride its edges, then close in at the centre.
  const e1 = ease(clamp(p / 0.5, 0, 1));
  const bw0 = Math.min(f.vw * 0.56, f.vh * 0.5 * 9 / 16), bh0 = bw0 * 16 / 9;
  const mw = lerp(bw0, f.vw, e1), mh = lerp(bh0, f.vh, e1), bT = (f.vh - mh) / 2;
  const k = ease(clamp((p - 0.5) / 0.2, 0, 1));   // halves close in
  const g = clamp((p - 0.64) / 0.14, 0, 1);         // gold rows
  const mid = f.vh * 0.36;
  const fs = Math.min(56, f.vw * 0.144);
  setStyle(box, 'width', `${mw}px`);
  setStyle(box, 'height', `${mh}px`);
  setStyle(box, 'border-radius', `${(6 * (1 - e1)).toFixed(2)}px`);
  setStyle(vid, 'transform', `scale(${(1.12 - 0.12 * e1).toFixed(4)})`);
  setStyle(dim, 'opacity', clamp((p - 0.22) / 0.2, 0, 1).toFixed(3));
  setStyle(h2, 'font-size', `${fs}px`);
  const y1 = Math.max(bT - 14, 96);            // bottom edge of "La maestria"
  const y2 = Math.min(bT + mh + 14, f.vh - 96); // top edge of "nei dettagli."
  const rows = {
    l1: [lerp(y1, mid, k), '-100%', 1],
    r1: [lerp(y2, mid, k), '0px', 1],
    l2: [mid + fs + 12, `${((1 - g) * 24).toFixed(1)}px`, g],
    r2: [mid + 2 * fs + 12, `${((1 - g) * 24).toFixed(1)}px`, g],
  } as const;
  (Object.keys(rows) as (keyof typeof rows)[]).forEach((key) => {
    const [t, ty, o] = rows[key], el = w[key];
    setStyle(el, 'left', '50%');
    setStyle(el, 'right', 'auto');
    setStyle(el, 'top', `${t}px`);
    setStyle(el, 'opacity', (+o).toFixed(3));
    setStyle(el, 'transform', `translate(-50%, ${ty})`);
  });
  setStyle(fn, 'opacity', '0');
  setStyle(fp, 'left', '28px');
  setStyle(fp, 'right', '28px');
  setStyle(fp, 'bottom', '48px');
  setStyle(fp, 'max-width', 'none');
  setStyle(fp, 'text-align', 'center');
  setStyle(fp, 'color', '#e3dccd');
  setStyle(fp, 'opacity', clamp((p - 0.8) / 0.12, 0, 1).toFixed(3));
  return;
}
```

### Timeline mobile (p = progresso nella sezione, 0→1)
| p | Cosa succede |
|---|---|
| 0 | box min(56vw, 50vh·9/16) × 16/9, radius 6px, video scale 1.12. "La maestria" bottom a box−14px, "nei dettagli." top a box+14px |
| 0 → .50 | box → 100vw × 100vh (easeInOutQuad), radius → 0, scale → 1. Le due metà seguono i bordi del box, fermandosi a 96px da sopra/sotto |
| .22 → .42 | dim 0 → 1 (rgba(12,11,10,.55)) |
| .50 → .70 | le due metà convergono (easeInOutQuad): "La maestria" bottom e "nei dettagli." top a 36vh |
| .64 → .78 | *Ogni scelta,* (top 36vh + 1em + 12px) e *una firma.* (top 36vh + 2em + 12px) entrano in oro, +24px → 0 |
| .80 → .92 | body centrato appare (left/right 28px, bottom 48px) |

## Details.astro: CSS mobile
- Altezza: `@media (max-width: 759px) { :global(.m) .details { height: 280vh; } }` (era 220vh: serve più corsa per le due fasi).
- Stato finale (no JS / reduced motion) nel blocco `@media (max-aspect-ratio: 105/100)`, al posto delle 4 righe centrate attuali:
  - `.title { font-size: min(56px, 14.4vw); }`
  - `.w { left: 50%; right: auto; transform: translateX(-50%); }`
  - `.l1 { top: 36%; transform: translate(-50%, -100%); }` · `.r1 { top: 36%; }`
  - `.l2 { top: calc(36% + 1em + 12px); }` · `.r2 { top: calc(36% + 2em + 12px); }`
  - `.fp { left: 28px; right: 28px; bottom: 48px; max-width: none; text-align: center; color: var(--fg-2); }` · `.fn { display: none; }`
- Stato iniziale `.m` (prima che parta lo script): `.box { width: min(56vw, calc(50vh * 9 / 16)); height: auto; aspect-ratio: 9 / 16; border-radius: 6px; }`, `.l2, .r2` opacity 0. Le posizioni di `l1`/`r1` le imposta lo script al primo frame.

## Tokens
Oro `#c2a36b` (`--gold`), body su video `#e3dccd` (`--fg-2`), dim `rgba(12,11,10,.55)`, serif `--serif`, sans `--sans`.

## Files in questo pacchetto
- `Baratto Home v8.dc.html`: pagina completa (sezione 07, `startColumn()` ramo `narrow`)
- `Baratto Dettagli Opzioni.dc.html`: opzione **3a** nel telefono 390×844
