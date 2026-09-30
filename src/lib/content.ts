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

export type Home = Awaited<ReturnType<typeof getHome>>;
export type Settings = Awaited<ReturnType<typeof getSettings>>;
