/** Desktop-only custom cursor (labels from [data-cursor]) and magnetic buttons. */
import { $$, lerp } from '../core/dom';
import { subscribe } from '../core/loop';

export function initCursor() {
  const cur = document.createElement('div');
  cur.className = 'cursor';
  cur.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  cur.appendChild(label);
  document.body.appendChild(cur);

  let mx = -200, my = -200, cx = mx, cy = my, s = 0.12, target = 0.12, idle = true;
  addEventListener('mousemove', (e) => {
    if (idle) { cx = e.clientX; cy = e.clientY; idle = false; }
    mx = e.clientX; my = e.clientY;
  }, { passive: true });
  document.addEventListener('mouseover', (e) => {
    const t = (e.target as Element).closest?.<HTMLElement>('[data-cursor],a,button');
    const lab = t?.dataset.cursor || '';
    target = !t ? 0.12 : lab ? 1 : 0.4;
    if (lab) label.textContent = lab;
    cur.classList.toggle('has-label', !!lab);
  });
  document.addEventListener('mouseleave', () => { target = 0; });

  subscribe(() => {
    if (Math.abs(mx - cx) < 0.1 && Math.abs(my - cy) < 0.1 && Math.abs(s - target) < 0.001) return;
    cx = lerp(cx, mx, 0.2); cy = lerp(cy, my, 0.2); s = lerp(s, target, 0.15);
    cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0) scale(${s.toFixed(3)})`;
  });

  $$('[data-magnetic]').forEach((m) => {
    m.addEventListener('mousemove', (e) => {
      const r = m.getBoundingClientRect();
      m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.3}px,${(e.clientY - r.top - r.height / 2) * 0.4}px)`;
    });
    m.addEventListener('mouseleave', () => { m.style.transform = ''; });
  });
}
