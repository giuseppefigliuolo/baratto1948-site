/**
 * /llms.txt — a plain-language, citation-friendly summary for AI assistants
 * and answer engines (GEO). Generated from the same CMS content as the page.
 */
import type { APIRoute } from 'astro';
import { getCatalogPage, getHome, getSettings, getTessuti } from '../lib/content';
import { plain } from '../lib/rich';
import { rootUrl } from '../lib/url';

export const GET: APIRoute = async ({ site }) => {
  const h = await getHome();
  const s = await getSettings();
  const a = s.address;
  const where = [a.street, `${a.postalCode} ${a.locality} (${a.province})`, a.region, 'Italia'].filter(Boolean).join(', ');
  const url = rootUrl(site!);
  const [jacket, trousers, fabrics] = [await getCatalogPage('giacca'), await getCatalogPage('pantalone'), await getTessuti()];
  // One line per category, then one "name: text" line per option.
  const options = (p: typeof jacket) => [
    plain(p.hero.intro),
    ...p.categories.map((c) => [
      `### ${plain(c.title.join(' '))}`,
      ...c.groups.flatMap((g) => [...(g.title ? [`${g.title}:`] : []), ...g.items.map((it) => `- ${it.name}: ${it.text}`)])
    ].join('\n'))
  ].join('\n');

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

## L'esperienza su misura
${h.process.steps.map((st, i) => `${i + 1}. ${st.kicker} (${st.title} ${st.titleAccent}): ${st.body}`).join('\n')}

## Cosa realizza
${h.collection.chapters.map((c) => `- ${c.title} ${c.titleAccent} (${c.kicker.toLowerCase()}): ${c.body}${c.id === 'pantalone' ? ` Modelli: ${c.extra}.` : ''}`).join('\n')}

## La giacca (${url}giacca)
${options(jacket)}

## Il pantalone (${url}pantalone)
${options(trousers)}

## I tessuti (${url}tessuti)
${fabrics.hero.intro}
${plain(fabrics.fibres.title.join(' '))}: ${fabrics.fibres.body}
${plain(fabrics.renylon.title.join(' '))}: ${fabrics.renylon.body.join(' ')}
${plain(fabrics.partners.title.join(' '))}
${fabrics.partners.groups.map((g) => `- ${g.title}: ${g.items.map((it) => `${it.name} (${it.year})`).join(', ')}`).join('\n')}
${fabrics.partners.note}
${plain(fabrics.denim.title.join(' '))}: ${fabrics.denim.body}
${fabrics.denim.features.map((f) => `- ${f.title}: ${f.body}`).join('\n')}

## Filosofia
${plain(h.manifesto.phrases.join(''))} ${plain(h.manifesto.body)} ${h.manifesto.bodyAccent}
${plain(h.process.phrases.join(''))} ${h.process.intro}
${plain(h.linings.phrases.join(''))} ${h.linings.body}
"${plain(h.quote.text)}" — ${h.quote.author}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
