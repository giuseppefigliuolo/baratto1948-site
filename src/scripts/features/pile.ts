/**
 * "Processo" stacked sticky cards: each card enters tilted and settles; the card
 * underneath leans back, dims and shrinks as the next one covers it.
 */
import { $, $$, clamp, easeOut3, setStyle } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';
import { watch } from '../core/visible';

export function initPile() {
  const cards = $$('[data-pile]');
  if (!cards.length) return;
  const zone = watch(cards[0].parentElement!, '10% 0px');
  const items = cards.map((c) => {
    const [r, x, er, ex] = c.dataset.pile!.split(',').map(Number);
    return { c, r, x, er, ex, dim: $('[data-pile-dim]', c), img: $('[data-pile-img]', c), top: 0, stick: 0 };
  });
  let prog: number[] = [];
  onMeasure(() => items.forEach((it) => { it.stick = parseFloat(getComputedStyle(it.c).top) || 0; }));

  subscribe({
    read(f) {
      if (!zone.on || !f.changed) return;
      for (const it of items) it.top = it.c.getBoundingClientRect().top;
    },
    write(f) {
      if (!zone.on || !f.changed) return;
      const k = f.vw < 760 ? 0.5 : 1;
      prog = items.map((it) => easeOut3(clamp(1 - (it.top - it.stick) / (f.vh * 0.85), 0, 1)));
      items.forEach((it, i) => {
        const p = prog[i], under = prog[i + 1] || 0;
        const lean = (it.r >= 0 ? 1 : -1) * 1.6 * under;
        const rot = it.er + (it.r - it.er) * p + lean;
        const tx = (it.ex + (it.x - it.ex) * p) * k;
        setStyle(it.c, 'transform', `translate3d(${tx.toFixed(1)}px,${(-10 * under).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${(1 - 0.05 * under).toFixed(4)})`);
        if (it.dim) setStyle(it.dim, 'opacity', (0.55 * under).toFixed(3));
        if (it.img) setStyle(it.img, 'transform', `scale(${(1.14 - 0.14 * p).toFixed(4)})`);
      });
    }
  });
}
