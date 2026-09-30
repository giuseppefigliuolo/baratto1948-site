/**
 * Scroll-linked effects driven from cached layout (no per-frame layout reads):
 *  parallax [data-speed], phrase focus [data-phrases], hero cover [data-cover],
 *  progress bar [data-progress], zoom reveal [data-zoomreveal].
 */
import { $, $$, clamp, docTop, hostOf, lerp, setStyle } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';

interface Box { top: number; h: number }

export function initScrollFx() {
  parallax();
  phrases();
  cover();
  progress();
  zoomReveal();
}

function parallax() {
  const items = $$('[data-speed]').map((el) => ({
    el,
    host: hostOf(el),
    speed: +el.dataset.speed!,
    zoom: el.dataset.zoom || '1',
    box: { top: 0, h: 0 } as Box
  }));
  if (!items.length) return;
  onMeasure(() => items.forEach((it) => { it.box = { top: docTop(it.host), h: it.host.offsetHeight }; }));
  subscribe((f) => {
    if (!f.changed) return;
    for (const it of items) {
      const top = it.box.top - f.y;
      if (top + it.box.h < -300 || top > f.vh + 300) continue;
      const mid = top + it.box.h / 2 - f.vh / 2;
      setStyle(it.el, 'transform', `translate3d(0,${(mid * -it.speed).toFixed(1)}px,0) scale(${it.zoom})`);
    }
  });
}

function phrases() {
  const boxes = $$('[data-phrases]').map((el) => ({ el, kids: $$('[data-phrase]', el), box: { top: 0, h: 0 } as Box }));
  if (!boxes.length) return;
  onMeasure(() => boxes.forEach((b) => { b.box = { top: docTop(b.el), h: b.el.offsetHeight }; }));
  subscribe((f) => {
    if (!f.changed) return;
    for (const b of boxes) {
      const top = b.box.top - f.y;
      if (top > f.vh * 1.2 || top + b.box.h < -f.vh * 0.5) continue;
      const p = clamp((f.vh * 0.85 - top) / (b.box.h + f.vh * 0.3), 0, 1);
      const n = b.kids.length;
      b.kids.forEach((k, i) => {
        const t = Math.round(clamp(p * n - i, 0, 1) * 50) / 50;
        setStyle(k, 'opacity', (0.12 + 0.88 * t).toFixed(2));
        setStyle(k, 'filter', t >= 1 ? 'none' : `blur(${((1 - t) * 4).toFixed(2)}px)`);
      });
    }
  });
}

function cover() {
  const sec = $('[data-cover]');
  const inner = sec && $('[data-cover-inner]', sec);
  if (!inner) return;
  subscribe((f) => {
    if (!f.changed || f.y > f.vh * 1.5) return;
    const p = clamp(f.y / f.vh, 0, 1);
    setStyle(inner, 'transform', `scale(${(1 - 0.1 * p).toFixed(4)}) translateY(${(p * 10).toFixed(2)}vh)`);
    setStyle(inner, 'opacity', (1 - 0.7 * p).toFixed(3));
    setStyle(inner, 'border-radius', `${(p * 24).toFixed(1)}px`);
  });
}

function progress() {
  const bar = $('[data-progress]');
  if (!bar) return;
  let max = 1;
  onMeasure(() => { max = Math.max(1, document.documentElement.scrollHeight - innerHeight); });
  subscribe((f) => {
    if (f.changed) setStyle(bar, 'transform', `scaleX(${(f.y / max).toFixed(4)})`);
  });
}

function zoomReveal() {
  const secs = $$('[data-zoomreveal]').map((sec) => ({
    sec,
    box: $('[data-zr-box]', sec)!,
    img: $('[data-zr-img]', sec)!,
    txt: $('[data-zr-text]', sec)!,
    dim: $('[data-zr-dim]', sec),
    b: { top: 0, h: 0 } as Box
  }));
  if (!secs.length) return;
  onMeasure(() => secs.forEach((s) => { s.b = { top: docTop(s.sec), h: s.sec.offsetHeight }; }));
  subscribe((f) => {
    if (!f.changed) return;
    const mob = f.vw < 760;
    for (const s of secs) {
      const top = s.b.top - f.y;
      if (top > f.vh || top + s.b.h < 0) continue;
      const p = clamp(-top / Math.max(1, s.b.h - f.vh), 0, 1);
      const e = 1 - Math.pow(1 - clamp(p / 0.7, 0, 1), 3);
      const ix = lerp(mob ? 14 : 34, 0, e), iy = lerp(mob ? 24 : 22, 0, e);
      setStyle(s.box, 'clip-path', `inset(${iy.toFixed(2)}% ${ix.toFixed(2)}% round ${lerp(6, 0, e).toFixed(1)}px)`);
      setStyle(s.img, 'transform', `scale(${lerp(1.35, 1, e).toFixed(4)})`);
      const tp = clamp((p - 0.55) / 0.3, 0, 1);
      setStyle(s.txt, 'opacity', tp.toFixed(3));
      setStyle(s.txt, 'transform', `translateY(${((1 - tp) * 60).toFixed(1)}px)`);
      if (s.dim) setStyle(s.dim, 'opacity', (tp * 0.55).toFixed(3));
    }
  });
}
