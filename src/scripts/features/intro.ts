/**
 * First-visit intro (≈0.7s): counter + image flicker, then the frame opens into
 * the hero. Skipped for returning visitors in the same session.
 */
import { $, $$, clamp, easeOut3 } from '../core/dom';
import { lockScroll } from '../core/smooth';

const KEY = 'b48-intro';
const COUNT_MS = 400;
const OPEN_MS = 160; // hand-off to the hero (menu + texts) while the frame is still settling
const FADE_MS = 320;

export function runIntro(): Promise<void> {
  const html = document.documentElement;
  const el = $('[data-intro-el]');
  if (!html.classList.contains('intro') || !el) {
    html.classList.remove('intro');
    el?.remove();
    return Promise.resolve();
  }
  try { sessionStorage.setItem(KEY, '1'); } catch {}
  lockScroll(true);

  const frame = $('[data-intro-frame]', el)!;
  const imgs = $$<HTMLImageElement>('img[data-intro-img]', el);
  const count = $('[data-intro-count]', el)!;
  let t0 = -1;
  let idx = 0;

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.style.opacity = '0';
      lockScroll(false);
      resolve();
      setTimeout(() => { html.classList.remove('intro'); el.remove(); }, FADE_MS);
    };
    // Never leave the page locked, whatever happens.
    const guard = setTimeout(finish, COUNT_MS + OPEN_MS + 2500);
    const tick = (now: number) => {
      try {
        if (t0 < 0) t0 = now;
        const p = clamp((now - t0) / COUNT_MS, 0, 1);
        count.textContent = String(Math.round(easeOut3(p) * 100));
        const next = clamp(Math.floor(p * imgs.length * 0.999), 0, imgs.length - 1);
        if (next !== idx && imgs[next]) { imgs[idx].style.opacity = '0'; imgs[next].style.opacity = '1'; idx = next; }
        if (p < 1) return void requestAnimationFrame(tick);
        el.classList.add('is-done');
        frame.classList.add('is-open');
        setTimeout(() => { clearTimeout(guard); finish(); }, OPEN_MS);
      } catch {
        finish();
      }
    };
    requestAnimationFrame(tick);
  });
}
