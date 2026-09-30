// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL: the canonical origin. On Netlify, URL is the primary site URL
// (the *.netlify.app address until a custom domain is connected).
const site = process.env.SITE_URL || process.env.URL || 'https://baratto1948-collaudo.netlify.app';

export default defineConfig({
  site,
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
      name: 'Hanken Grotesk',
      cssVariable: '--font-sans',
      weights: [400, 500, 600],
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
