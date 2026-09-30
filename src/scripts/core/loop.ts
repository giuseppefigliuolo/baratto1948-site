/**
 * One requestAnimationFrame loop for the whole page.
 *  - `read` callbacks run first (layout reads), then `write` callbacks (style writes),
 *    so the browser never has to lay out twice in a frame.
 *  - Frame state tells subscribers whether scroll/size changed, so static frames
 *    cost almost nothing.
 *  - Layout caches are rebuilt only on resize (see `onMeasure`).
 */
import { lerp } from './dom';

export interface Frame {
  now: number;
  y: number;
  dy: number;
  vel: number;
  dir: 1 | -1;
  vw: number;
  vh: number;
  /** scroll position or viewport changed since the last frame */
  changed: boolean;
}

type Fn = (f: Frame) => void;
interface Sub { read?: Fn; write: Fn }

const subs = new Set<Sub>();
const measures = new Set<() => void>();
let driver: ((now: number) => void) | null = null;

export const frame: Frame = {
  now: 0, y: scrollY, dy: 0, vel: 0, dir: 1, vw: innerWidth, vh: innerHeight, changed: true
};

let lastY = scrollY;
let dirty = true;

function tick(now: number) {
  driver?.(now); // Lenis
  const y = scrollY;
  const dy = y - lastY;
  lastY = y;
  frame.now = now;
  frame.dy = dy;
  frame.y = y;
  frame.vel = lerp(frame.vel, dy, 0.12);
  if (Math.abs(frame.vel) < 0.001) frame.vel = 0;
  if (Math.abs(dy) > 0.5) frame.dir = dy > 0 ? 1 : -1;
  frame.changed = dirty || dy !== 0;
  dirty = false;
  for (const s of subs) s.read?.(frame);
  for (const s of subs) s.write(frame);
  requestAnimationFrame(tick);
}

export function subscribe(sub: Sub | Fn) {
  const s = typeof sub === 'function' ? { write: sub } : sub;
  subs.add(s);
  return () => subs.delete(s);
}

/** Register a layout-cache builder; it runs now and after every resize. */
export function onMeasure(fn: () => void) {
  measures.add(fn);
  fn();
  return () => measures.delete(fn);
}

export function remeasure() {
  frame.vw = innerWidth;
  frame.vh = innerHeight;
  measures.forEach((m) => m());
  dirty = true;
}

export function setDriver(fn: (now: number) => void) {
  driver = fn;
}

let started = false;
export function start() {
  if (started) return;
  started = true;
  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(remeasure);
  };
  addEventListener('resize', schedule, { passive: true });
  // Content height changes (fonts, images, CMS text length) shift section offsets.
  new ResizeObserver(schedule).observe(document.body);
  document.fonts?.ready.then(schedule);
  addEventListener('load', schedule, { once: true });
  requestAnimationFrame(tick);
}
