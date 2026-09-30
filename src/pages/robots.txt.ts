import type { APIRoute } from 'astro';

// Collaudo builds block crawlers; set INDEXABLE=true on the production site.
export const GET: APIRoute = ({ site }) => {
  const indexable = process.env.INDEXABLE === 'true';
  const body = indexable
    ? `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`
    : `User-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
