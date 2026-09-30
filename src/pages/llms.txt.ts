/**
 * /llms.txt — a plain-language, citation-friendly summary for AI assistants
 * and answer engines (GEO). Generated from the same CMS content as the page.
 */
import type { APIRoute } from 'astro';
import { getHome, getSettings } from '../lib/content';
import { plain } from '../lib/rich';
import { rootUrl } from '../lib/url';

export const GET: APIRoute = async ({ site }) => {
  const h = await getHome();
  const s = await getSettings();
  const a = s.address;
  const where = [a.street, `${a.postalCode} ${a.locality} (${a.province})`, a.region, 'Italia'].filter(Boolean).join(', ');
  const url = rootUrl(site!);

  const body = `# ${s.brand}

> ${h.seo.description}

${s.brand} è una sartoria artigianale italiana fondata nel ${s.foundingYear} a ${a.locality}, in ${a.region}. Realizza abiti, giacche e pantaloni su misura, cuciti a mano da maestri sarti. Fondatore e direttore creativo: ${s.founder} (formazione all'Istituto Marangoni di Milano). Il marchio partecipa a Pitti Immagine e alle principali fiere di settore.

## Contatti
- Sito: ${url}
- Telefono: ${s.phoneDisplay}
- Email: ${s.email}
- Instagram: ${s.instagram}
- Sede: ${where}

## Storia
${plain(h.heritage.roots.lead)} ${h.heritage.roots.body}
${plain(h.heritage.founder.lead)} ${h.heritage.founder.body}

## Il processo su misura
${h.process.steps.map((st, i) => `${i + 1}. ${st.title} ${st.titleAccent}: ${st.body}`).join('\n')}

## Cosa realizza
${h.collection.chapters.map((c) => `- ${c.title} ${c.titleAccent} (${c.kicker.toLowerCase()}): ${c.body}${c.id === 'pantalone' ? ` Modelli: ${c.extra}.` : ''}`).join('\n')}

## Filosofia
${plain(h.manifesto.phrases.join(''))} ${h.manifesto.body}
${plain(h.today.phrases.join(''))}
"${plain(h.quote.text)}" — ${h.quote.author}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
