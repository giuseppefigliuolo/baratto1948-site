// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL / BASE_PATH: canonical origin and sub-path. The GitHub Pages workflow sets both from
// actions/configure-pages (github.io/<repo>/ now; custom domain at root once connected).
const site = process.env.SITE_URL || 'https://giuseppefigliuolo.github.io';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  build: {
    // Single landing page: inlining all CSS removes a render-blocking request.
    inlineStylesheets: 'always',
    format: 'directory'
  },
  compressHTML: true,
  prefetch: false,
  i18n: {
    // Italian only for now. Add 'en' here and a src/pages/en/ route to go bilingual.
    locales: ['it'],
    defaultLocale: 'it'
  },
  image: {
    // Sharp is the default service; keep responsive output tight.
    breakpoints: [480, 768, 1080, 1440, 1920]
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Instrument Serif',
      cssVariable: '--font-serif',
      weights: [400],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['Times New Roman', 'serif']
    },
    {
      provider: fontProviders.google(),
      name: 'Roboto',
      cssVariable: '--font-sans',
      // Variable axis: one file covers the thin (100–300) / bold (700) contrast.
      weights: ['100 900'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['Helvetica Neue', 'Arial', 'sans-serif']
    }
  ],
  integrations: [sitemap()],
  vite: {
    build: { assetsInlineLimit: 2048 }
  }
});
