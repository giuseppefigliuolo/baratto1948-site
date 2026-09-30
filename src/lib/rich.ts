/**
 * Minimal, safe inline markup for CMS text:
 *   *text*  -> <em>text</em>
 *   \n      -> <br>
 * Everything else is HTML-escaped, so editors can't inject markup.
 */
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

export function rich(s: string): string {
  return escape(s)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/** Plain text version (for alt/meta/JSON-LD). */
export const plain = (s: string) => s.replace(/\*/g, '').replace(/\s*\n\s*/g, ' ').trim();
