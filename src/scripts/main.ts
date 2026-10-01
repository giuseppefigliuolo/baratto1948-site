/**
 * Entry point. Loading order is tuned for Core Web Vitals:
 *  1. menu + anchors (work with or without motion)
 *  2. motion core: one rAF loop, scroll effects, reveals, intro
 *  3. hero seal (three.js) right after the intro, so its timeline starts with the Ken Burns
 *  4. WebGL effects, lazily, once the page is idle and only on capable devices
 */
import { fine } from './core/dom';
import { start } from './core/loop';
import { initSmooth } from './core/smooth';
import { initCollection } from './features/collection';
import { initCursor } from './features/cursor';
import { initHeader } from './features/header';
import { initHpile } from './features/hpile';
import { runIntro } from './features/intro';
import { initMarquee } from './features/marquee';
import { initMenu } from './features/menu';
import { initPile } from './features/pile';
import { initReveal } from './features/reveal';
import { initScrollFx } from './features/scroll-fx';

const html = document.documentElement;
const motion = html.classList.contains('m');
// Module state used by the top-level code below: declared first (a later `const` would still be in its TDZ).
let canGL: boolean | undefined;
let sealChunk: Promise<typeof import('./gl/seal')> | undefined;
const sealModule = () => (sealChunk ||= import('./gl/seal'));

initSmooth(motion);
initMenu();
initHeader();

if (motion) {
  const ready = runIntro();
  initReveal(ready);
  initScrollFx();
  initPile();
  initHpile();
  initCollection();
  initMarquee();
  if (fine()) initCursor();
  start();
  // The seal is built meanwhile, but its timeline (and the Ken Burns) waits for the photo on screen:
  // first the printed stamp, then the bronze coin rising out of it.
  const photoIn = ready.then(heroPhoto).then(() => { kenBurns(); return performance.now(); });
  // Fetch and parse the three.js chunk while the intro plays, not after it.
  if (capable()) idle(() => sealModule().catch(() => {}));
  ready.then(() => {
    loadSeal({ start: photoIn });
    idle(loadGL);
  });
} else {
  loadSeal({ start: heroPhoto().then(() => 0), still: true });
}

/** Resolves once the hero photo is decoded (or failed: the page must not wait forever). */
function heroPhoto(): Promise<void> {
  const img = document.querySelector<HTMLImageElement>('[data-seal-frame] img');
  if (!img) return Promise.resolve();
  const load = img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise<void>((res) => {
      img.addEventListener('load', () => res(), { once: true });
      img.addEventListener('error', () => res(), { once: true });
    });
  return load.then(() => img.decode().catch(() => {}));
}

/** Hero photo (and the seal canvas inside the same frame) settles from 1.12 to 1 over 6.4 s. */
function kenBurns() {
  document.querySelector<HTMLElement>('[data-seal-frame]')?.animate(
    { scale: ['1.12', '1'] },
    { duration: 6400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }
  );
}

async function loadSeal(opts: { start: Promise<number>; still?: boolean }) {
  const frame = document.querySelector<HTMLElement>('[data-seal-frame]');
  if (!frame || !capable()) return;
  try {
    const { seal } = await sealModule();
    await seal(frame, opts);
  } catch (e) {
    // The printed stamp in the photo stands on its own.
    console.warn('[seal] unavailable', e);
  }
}

function idle(fn: () => unknown) {
  const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  ric ? ric(fn, { timeout: 2500 }) : setTimeout(fn, 600);
}

/** Device gate for every WebGL effect; probed once (each probe would open a throw-away context). */
function capable() {
  if (canGL !== undefined) return canGL;
  const nav = navigator as any;
  if (nav.connection?.saveData) return (canGL = false);
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return (canGL = false);
  return (canGL = !!document.createElement('canvas').getContext('webgl'));
}

async function loadGL() {
  if (!capable()) return;
  const [{ liquid }, { atelier }] = await Promise.all([import('./gl/liquid'), import('./gl/atelier')]);
  document.querySelectorAll<HTMLImageElement>('img[data-gl]').forEach((img) => liquid(img));
  const at = document.querySelector<HTMLElement>('[data-atelier]');
  if (at) atelier(at);
}
