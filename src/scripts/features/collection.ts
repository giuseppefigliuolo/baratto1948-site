/**
 * "Collezione": vertical scroll drives a horizontal track of chapter cards
 * (variant A · soft parallax: side cards shrink, dim and drift).
 * Chapter cards also skew with scroll velocity.
 */
import { $, $$, clamp, docTop, setStyle } from '../core/dom';
import { onMeasure, subscribe } from '../core/loop';
import { watch } from '../core/visible';

export function initCollection() {
  const sec = $('[data-coll]');
  const track = sec && $('[data-coll-track]', sec);
  if (!sec || !track) return;
  const viewport = $('[data-coll-viewport]', sec)!;
  const bar = $('[data-coll-bar]', sec);
  const ctr = $('[data-coll-ctr]', sec);
  const skews = $$('[data-skew]', sec);
  const cards = $$('[data-coll-card]', sec).map((c) => ({
    c,
    img: $('[data-coll-img]', c)!,
    dim: $('[data-coll-dim]', c)!,
    body: $('[data-coll-body]', c)!
  }));
  const n = cards.length;
  if (n < 2) return;
  const zone = watch(sec, '10% 0px');
  let top = 0, total = 1, dist = 0, act = -1, skewed = false;

  onMeasure(() => {
    top = docTop(sec);
    total = Math.max(1, sec.offsetHeight - innerHeight);
    dist = Math.max(0, track.scrollWidth - viewport.clientWidth);
  });

  subscribe((f) => {
    if (!zone.on) return;
    // Velocity skew keeps easing out after scrolling stops.
    const sk = clamp(f.vel * 0.12, -7, 7) * -0.6;
    if (Math.abs(sk) > 0.005 || skewed) {
      skewed = Math.abs(sk) > 0.005;
      const v = skewed ? `skewX(${sk.toFixed(2)}deg)` : 'none';
      skews.forEach((s) => setStyle(s, 'transform', v));
    }
    if (!f.changed) return;
    const p = clamp((f.y - top) / total, 0, 1);
    const seg = p * (n - 1);
    setStyle(track, 'transform', `translate3d(${(-(seg / (n - 1)) * dist).toFixed(1)}px,0,0)`);
    if (bar) setStyle(bar, 'transform', `scaleX(${(seg / (n - 1)).toFixed(4)})`);
    const a = Math.round(seg);
    if (a !== act && ctr) { act = a; ctr.textContent = String(a + 1).padStart(2, '0'); }
    cards.forEach((it, i) => {
      const d = clamp(i - seg, -1.2, 1.2), m = Math.min(1, Math.abs(d));
      // Pin the edge facing the active card so the shrink never opens a gap between cards.
      setStyle(it.c, 'transform-origin', `${(50 - 50 * clamp(d * 2, -1, 1)).toFixed(1)}% 50%`);
      setStyle(it.c, 'transform', `scale(${(1 - 0.1 * m).toFixed(4)})`);
      setStyle(it.img, 'transform', `translate3d(${(-d * 7).toFixed(2)}%,0,0) scale(${(1.04 + 0.08 * m).toFixed(4)})`);
      setStyle(it.dim, 'opacity', (0.6 * m).toFixed(3));
      setStyle(it.body, 'opacity', (1 - 0.85 * m).toFixed(3));
      setStyle(it.body, 'transform', `translate3d(${(d * 24).toFixed(1)}px,0,0)`);
    });
  });
}
