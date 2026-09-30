/**
 * Smooth scrolling (Lenis, wheel only — touch stays native) and anchor navigation.
 * Anchors into the horizontal "Collezione" track resolve to the scroll position
 * where that chapter is centred, instead of the sticky container's top.
 */
import Lenis from 'lenis';
import { $, $$, docTop } from './dom';
import { setDriver } from './loop';

let lenis: Lenis | null = null;
const easeOut4 = (x: number) => 1 - Math.pow(1 - x, 4);

export function initSmooth(motion: boolean) {
  if (motion) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9, autoRaf: false });
    setDriver((now) => lenis!.raf(now));
  }
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.hasAttribute('data-menu-link')) return;
    const hash = a.getAttribute('href')!;
    if (hash.length < 2) return;
    if (scrollToHash(hash)) e.preventDefault();
  });
}

function targetY(el: HTMLElement): number {
  const coll = el.closest<HTMLElement>('[data-coll]');
  const html = document.documentElement;
  if (coll && el.hasAttribute('data-skew') && html.classList.contains('m')) {
    const chapters = $$('[data-skew]', coll);
    const i = chapters.indexOf(el);
    const total = coll.offsetHeight - innerHeight;
    return docTop(coll) + (chapters.length > 1 ? (i / (chapters.length - 1)) * total : 0);
  }
  return el.id === 'top' ? 0 : docTop(el);
}

export function scrollToHash(hash: string, duration = 1.8): boolean {
  const el = $(hash);
  if (!el) return false;
  const y = targetY(el);
  if (lenis) lenis.scrollTo(y, { duration, easing: easeOut4, force: true });
  else if (el.closest('[data-coll]') && !document.documentElement.classList.contains('m')) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  else scrollTo({ top: y, behavior: 'smooth' });
  history.replaceState(null, '', hash);
  return true;
}

export function lockScroll(lock: boolean) {
  document.documentElement.style.overflow = lock ? 'hidden' : '';
  if (lenis) lock ? lenis.stop() : lenis.start();
}
