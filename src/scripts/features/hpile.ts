/**
 * Catalogue "horizontal pile": the section pins and vertical scroll deals the cards one by one.
 * Each card enters from the right tilted and settles on the previous one; the card underneath
 * leans back, dims, shrinks and loses its colour as the next one covers it.
 */
import { $, $$, clamp, docTop, easeOut3, setStyle } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';
import { watch } from '../core/visible';

const pad = (n: number) => String(n).padStart(2, '0');

export function initHpile() {
  $$('[data-hpile]').forEach(setup);
}

function setup(root: HTMLElement) {
  const stage = $('[data-hpile-stage]', root);
  const cards = $$('[data-hpile-card]', root).map((c) => {
    const [r, x, er] = c.dataset.hpileCard!.split(',').map(Number);
    return { c, r, x, er, dim: $('[data-hpile-dim]', c), img: $('[data-hpile-img]', c) };
  });
  const n = cards.length;
  // A single card has nothing to deal.
  if (!stage || n < 2) return;
  const bar = $('[data-hpile-bar]', root);
  const ctr = $('[data-hpile-ctr]', root);
  const zone = watch(root, '10% 0px');
  let top = 0, total = 1, width = 0, shown = -1;

  onMeasure(() => {
    top = docTop(root);
    total = Math.max(1, root.offsetHeight - innerHeight);
    width = stage.clientWidth;
  });

  subscribe((f) => {
    if (!zone.on || !f.changed) return;
    const p = clamp((f.y - top) / total, 0, 1);
    const seg = p * (n - 1);
    const k = f.vw < 760 ? 0.5 : 1;
    // t: how far card i has arrived (the first one is always in place); u: how much the next one covers it.
    const t = cards.map((_, i) => (i === 0 ? 1 : easeOut3(clamp(seg - (i - 1), 0, 1))));
    cards.forEach((it, i) => {
      const ti = t[i], u = t[i + 1] ?? 0;
      const tx = (1 - ti) * 1.12 * width + it.x * k * ti;
      const rot = it.er * (1 - ti) + it.r * ti + (it.r >= 0 ? 1 : -1) * 1.6 * u;
      setStyle(it.c, 'transform', `translate3d(${tx.toFixed(1)}px,${(-10 * u).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${(1 - 0.05 * u).toFixed(4)})`);
      if (it.dim) setStyle(it.dim, 'opacity', (0.55 * u).toFixed(3));
      if (it.img) {
        // Desaturate what is entering and what is being covered; the card on top is in colour.
        const g = Math.max(1 - ti, u);
        setStyle(it.img, 'transform', `scale(${(1.14 - 0.14 * ti).toFixed(4)})`);
        setStyle(it.img, 'filter', `grayscale(${(0.85 * g).toFixed(3)}) sepia(${(0.2 * g).toFixed(3)}) brightness(${(1 - 0.08 * g).toFixed(3)})`);
      }
    });
    if (bar) setStyle(bar, 'transform', `scaleX(${p.toFixed(4)})`);
    const a = Math.round(seg);
    if (ctr && a !== shown) { shown = a; ctr.textContent = pad(a + 1); }
  });
}
