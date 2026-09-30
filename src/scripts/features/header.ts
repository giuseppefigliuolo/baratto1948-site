/** Hides the header logo once the contact section (which has its own large seal) fills the top half. */
import { $ } from '../core/dom';

export function initHeader() {
  const logo = $('.hdr-logo'), contact = $('#contatti');
  if (!logo || !contact) return;
  new IntersectionObserver(
    ([e]) => logo.classList.toggle('is-hidden', e.isIntersecting),
    { rootMargin: '0px 0px -50% 0px' }
  ).observe(contact);
}
