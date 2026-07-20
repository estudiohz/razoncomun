import { rutasPublicas, site } from '@/lib/site';

/**
 * sitemap.xml como route handler (evita el bug EISDIR de las metadata routes
 * de Next en Windows con rutas que contienen espacios). Solo rutas públicas.
 */
export const dynamic = 'force-static';

export function GET() {
  const ahora = new Date().toISOString();
  const urls = rutasPublicas
    .map((ruta) => {
      const loc = ruta === '/' ? site.urlBase : `${site.urlBase}${ruta}`;
      const priority = ruta === '/' ? '1.0' : '0.8';
      const freq = ruta === '/' ? 'daily' : 'weekly';
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${ahora}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
