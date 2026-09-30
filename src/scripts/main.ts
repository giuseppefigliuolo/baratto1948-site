/**
 * Entry point. Loading order is tuned for Core Web Vitals:
 *  1. menu + anchors (work with or without motion)
 *  2. motion core: one rAF loop, scroll effects, reveals, intro
 *  3. WebGL effects, lazily, once the page is idle and only on capable devices
 */
import { fine } from './core/dom';
import { start } from './core/loop';
import { initSmooth } from './core/smooth';
import { initCollection } from './features/collection';
import { initCursor } from './features/cursor';
import { runIntro } from './features/intro';
import { initMarquee } from './features/marquee';
import { initMenu } from './features/menu';
import { initPile } from './features/pile';
import { initReveal } from './features/reveal';
import { initScrollFx } from './features/scroll-fx';

const html = document.documentElement;
const motion = html.classList.contains('m');

initSmooth(motion);
initMenu();

if (motion) {
  const ready = runIntro();
  initReveal(ready);
  initScrollFx();
  initPile();
  initCollection();
  initMarquee();
  if (fine()) initCursor();
  start();
  ready.then(() => idle(loadGL));
}

function idle(fn: () => void) {
  const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  ric ? ric(fn, { timeout: 2500 }) : setTimeout(fn, 600);
}

function capable() {
  const nav = navigator as any;
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;
  const c = document.createElement('canvas');
  return !!c.getContext('webgl');
}

async function loadGL() {
  if (!capable()) return;
  const [{ liquid }, { atelier }] = await Promise.all([import('./gl/liquid'), import('./gl/atelier')]);
  const heroImg = document.querySelector<HTMLImageElement>('.hero-img');
  const heroHost = document.querySelector<HTMLElement>('[data-hero-host]');
  if (heroImg && heroHost) liquid(heroImg, heroHost, { hero: true, posY: 0.4 });
  document.querySelectorAll<HTMLImageElement>('img[data-gl]').forEach((img) => liquid(img));
  const at = document.querySelector<HTMLElement>('[data-atelier]');
  if (at) atelier(at);
}
