/**
 * Cheap "is this near the viewport?" flags backed by shared IntersectionObservers.
 * Features skip all work for sections that are off-screen.
 */
export interface Watch { on: boolean }

const observers = new Map<string, IntersectionObserver>();
const flags = new WeakMap<Element, Watch>();

export function watch(el: Element, margin = '25% 0px'): Watch {
  let io = observers.get(margin);
  if (!io) {
    io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { const w = flags.get(e.target); if (w) w.on = e.isIntersecting; }),
      { rootMargin: margin }
    );
    observers.set(margin, io);
  }
  const w: Watch = { on: false };
  flags.set(el, w);
  io.observe(el);
  return w;
}
