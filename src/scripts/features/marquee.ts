/** Infinite marquee whose speed and direction follow scroll velocity. */
import { $$, clamp, setStyle } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';
import { watch } from '../core/visible';

export function initMarquee() {
  const items = $$('[data-marquee]').map((el) => ({ el, x: 0, half: 0, zone: watch(el, '0px') }));
  if (!items.length) return;
  onMeasure(() => items.forEach((m) => { m.half = m.el.scrollWidth / 2; }));
  subscribe((f) => {
    const sk = clamp(f.vel * 0.12, -7, 7);
    for (const m of items) {
      if (!m.zone.on || !m.half) continue;
      m.x -= (0.6 + Math.abs(f.vel) * 0.35) * f.dir;
      if (m.x < -m.half) m.x += m.half;
      if (m.x > 0) m.x -= m.half;
      setStyle(m.el, 'transform', `translate3d(${m.x.toFixed(1)}px,0,0) skewX(${(-sk * 0.8).toFixed(2)}deg)`);
    }
  });
}
