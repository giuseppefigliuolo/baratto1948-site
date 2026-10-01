import { getEntry } from 'astro:content';

export async function getHome() {
  const entry = await getEntry('pages', 'home');
  if (!entry) throw new Error('Missing src/content/pages/home.json');
  return entry.data;
}

export async function getSettings() {
  const entry = await getEntry('settings', 'site');
  if (!entry) throw new Error('Missing src/content/settings/site.json');
  return entry.data;
}

/** Inner pages built around a catalogue of options: giacca, pantalone. */
export async function getCatalogPage(id: 'giacca' | 'pantalone') {
  const entry = await getEntry('catalogPages', id);
  if (!entry) throw new Error(`Missing src/content/pages/${id}.json`);
  return entry.data;
}

export async function getTessuti() {
  const entry = await getEntry('tessutiPage', 'tessuti');
  if (!entry) throw new Error('Missing src/content/pages/tessuti.json');
  return entry.data;
}

export type Home = Awaited<ReturnType<typeof getHome>>;
export type Settings = Awaited<ReturnType<typeof getSettings>>;
export type CatalogPage = Awaited<ReturnType<typeof getCatalogPage>>;
export type Category = CatalogPage['categories'][number];
export type CatalogItem = Category['groups'][number]['items'][number];
export type TessutiPage = Awaited<ReturnType<typeof getTessuti>>;
