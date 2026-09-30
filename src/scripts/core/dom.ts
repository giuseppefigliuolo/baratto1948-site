export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOut3 = (t: number) => 1 - Math.pow(1 - t, 3);

export const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
export const isMobile = () => innerWidth < 760;

/** Layout box of an image: skips the display:contents <picture> wrapper. */
export function hostOf(el: Element): HTMLElement {
  const p = el.parentElement!;
  return (p.tagName === 'PICTURE' ? p.parentElement : p) as HTMLElement;
}

/** Document-space top of an element (no transforms of its own ancestors assumed). */
export function docTop(el: Element): number {
  return el.getBoundingClientRect().top + scrollY;
}

/** Write a style property only when the value actually changes. */
export function setStyle(el: HTMLElement & { _s?: Record<string, string> }, prop: string, value: string) {
  const cache = (el._s ||= {});
  if (cache[prop] === value) return;
  cache[prop] = value;
  el.style.setProperty(prop, value);
}
