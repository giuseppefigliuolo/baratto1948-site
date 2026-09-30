/**
 * Scroll-linked effects driven from cached layout (no per-frame layout reads):
 *  parallax [data-speed], phrase focus [data-phrases], hero cover [data-cover],
 *  progress bar [data-progress], zoom reveal [data-zoomreveal], video column [data-column].
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
  column();
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

/**
 * 07 Dettagli: 9:16 video grows from a small window. Landscape ("Colonna"): to full height, title split
 * either side of it. Portrait ("Respiro"): to full screen, title halves ride its edges, then close in.
 */
function column() {
  const sec = $('[data-column]');
  if (!sec) return;
  const box = $('[data-col-box]', sec)!, vid = $<HTMLVideoElement>('[data-col-video]', sec)!;
  const dim = $('[data-col-dim]', sec)!, h2 = $('[data-col-title]', sec)!;
  const fn = $('[data-col-foot="n"]', sec)!, fp = $('[data-col-foot="p"]', sec)!;
  const w = { l1: $('[data-col-w="l1"]', sec)!, r1: $('[data-col-w="r1"]', sec)!, l2: $('[data-col-w="l2"]', sec)!, r2: $('[data-col-w="r2"]', sec)! };
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  vid.muted = true;
  vid.addEventListener('error', () => sec.classList.add('no-video'));
  let b: Box = { top: 0, h: 0 }, playing = true; // `autoplay` starts it
  onMeasure(() => { b = { top: docTop(sec), h: sec.offsetHeight }; });
  subscribe((f) => {
    if (!f.changed) return;
    const top = b.top - f.y;
    // Decode only while the section is on screen.
    const on = !(top > f.vh + 50 || top + b.h < -50);
    if (on !== playing) { playing = on; on ? vid.play().catch(() => {}) : vid.pause(); }
    if (!on) return;
    const p = clamp(-top / Math.max(1, b.h - f.vh), 0, 1);
    const narrow = f.vw < f.vh * 1.05;

    if (narrow) {
      // Portrait "Respiro": video grows, title halves ride its edges, then close in at the centre.
      const e1 = ease(clamp(p / 0.5, 0, 1));
      const bw0 = Math.min(f.vw * 0.56, f.vh * 0.5 * 9 / 16), bh0 = bw0 * 16 / 9;
      const mw = lerp(bw0, f.vw, e1), mh = lerp(bh0, f.vh, e1), bT = (f.vh - mh) / 2;
      const k = ease(clamp((p - 0.5) / 0.2, 0, 1)); // halves close in
      const g = clamp((p - 0.64) / 0.14, 0, 1); // gold rows
      const mid = f.vh * 0.36;
      const fs = Math.min(56, f.vw * 0.144);
      setStyle(box, 'width', `${mw}px`);
      setStyle(box, 'height', `${mh}px`);
      setStyle(box, 'border-radius', `${(6 * (1 - e1)).toFixed(2)}px`);
      setStyle(vid, 'transform', `scale(${(1.12 - 0.12 * e1).toFixed(4)})`);
      setStyle(dim, 'opacity', clamp((p - 0.22) / 0.2, 0, 1).toFixed(3));
      setStyle(h2, 'font-size', `${fs}px`);
      const y1 = Math.max(bT - 14, 96); // bottom edge of "La maestria"
      const y2 = Math.min(bT + mh + 14, f.vh - 96); // top edge of "nei dettagli."
      const gy = `${((1 - g) * 24).toFixed(1)}px`;
      const rows = {
        l1: [lerp(y1, mid, k), '-100%', 1],
        r1: [lerp(y2, mid, k), '0px', 1],
        l2: [mid + fs + 12, gy, g],
        r2: [mid + 2 * fs + 12, gy, g]
      } as const;
      (Object.keys(rows) as (keyof typeof rows)[]).forEach((key) => {
        const [t, ty, o] = rows[key], el = w[key];
        setStyle(el, 'left', '50%');
        setStyle(el, 'right', 'auto');
        setStyle(el, 'top', `${t.toFixed(1)}px`);
        setStyle(el, 'opacity', o.toFixed(3));
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

    // Landscape "Colonna": the box grows to full height at 9:16.
    const e = ease(clamp(p / 0.55, 0, 1));
    const r2 = clamp((p - 0.5) / 0.18, 0, 1), ft = clamp((p - 0.78) / 0.12, 0, 1);
    const bh = f.vh * (0.56 + 0.44 * e), bw = bh * 9 / 16;
    setStyle(box, 'width', `${bw}px`);
    setStyle(box, 'height', `${bh}px`);
    setStyle(box, 'border-radius', `${(4 * (1 - e)).toFixed(2)}px`);
    setStyle(vid, 'transform', `scale(${(1.12 - 0.12 * e).toFixed(4)})`);

    // Landscape: title split either side of the video.
    setStyle(dim, 'opacity', '0');
    const gap = Math.max(24, f.vw * 0.028), pad = Math.max(20, f.vw * 0.04);
    const sideEnd = (f.vw - f.vh * 9 / 16) / 2 - gap - pad; // side room once the video is fully open
    setStyle(h2, 'font-size', `${Math.max(40, Math.min(112, f.vh * 0.093, sideEnd / 4.8))}px`);
    const edge = `calc(50% + ${(bw / 2 + gap).toFixed(1)}px)`;
    const edgeEnd = `calc(50% + ${(f.vh * 9 / 32 + gap).toFixed(1)}px)`;
    const row1 = `${50 - 6 * r2}%`;
    ([['l1', row1, 1, 0], ['r1', row1, 1, 0], ['l2', '56%', r2, 1], ['r2', '56%', r2, 1]] as const).forEach(([k, t, o, two]) => {
      const el = w[k], left = k[0] === 'l';
      setStyle(el, 'top', t);
      setStyle(el, 'left', left ? 'auto' : edge);
      setStyle(el, 'right', left ? edge : 'auto');
      setStyle(el, 'opacity', o.toFixed(3));
      setStyle(el, 'transform', `translateY(calc(-50% + ${(two ? (1 - o) * 30 : 0).toFixed(1)}px))`);
    });
    setStyle(fn, 'right', edgeEnd);
    setStyle(fp, 'left', edgeEnd);
    setStyle(fp, 'right', 'auto');
    setStyle(fp, 'bottom', '64px');
    setStyle(fp, 'max-width', `${Math.min(336, sideEnd)}px`);
    setStyle(fp, 'text-align', 'left');
    setStyle(fp, 'color', '#bdb4a4');
    setStyle(fn, 'opacity', ft.toFixed(3));
    setStyle(fp, 'opacity', ft.toFixed(3));
  });
}
