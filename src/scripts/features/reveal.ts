/**
 * Enter-viewport reveals. Only toggles a class; the animation itself is CSS
 * (transform / opacity / clip-path, with per-element delay via --d).
 *  [data-line]  masked line slide-up  (triggered by its parent)
 *  [data-fade]  fade + rise
 *  [data-clip]  clip-path wipe        (triggered by its parent)
 */
import { $$ } from '../core/dom';

type Group = Element & { _rev?: Element[] };

export function initReveal(ready: Promise<void>) {
  let isReady = false;
  const pending: Element[][] = [];
  const show = (els: Element[]) => els.forEach((el) => el.classList.add('is-in'));

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const els = (e.target as Group)._rev || [e.target];
        isReady ? show(els) : pending.push(els);
      }
    },
    { threshold: 0.1 }
  );

  const group = (el: Element) => {
    const par = el.parentElement as Group;
    if (!par._rev) { par._rev = []; io.observe(par); }
    par._rev.push(el);
  };
  $$('[data-line], [data-clip]').forEach(group);
  $$('[data-fade]').forEach((el) => io.observe(el));

  ready.then(() => { isReady = true; pending.splice(0).forEach(show); });
}
