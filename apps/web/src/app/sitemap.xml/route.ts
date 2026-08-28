import { rutasPublicas, site } from '@/lib/site';
import { listarCategorias, listarSlugsPublicados } from '@/lib/blog/consultas';
import { manifiestoParaSitemap, paginasParaSitemap } from '@/lib/sitemapContenido';

/**
 * sitemap.xml como route handler (evita el bug EISDIR de las metadata routes
 * de Next en Windows con rutas que contienen espacios). Solo rutas públicas.
 *
 * Cubre: rutas estáticas, categorías y artículos publicados, páginas del CMS y
 * puntos del manifiesto. El cerebro queda fuera (no necesita indexarse) y
 * /propuestas y /votaciones tampoco entran: robots.txt ya las excluye.
 *
 * rc-05 añade el contenido: categorías y artículos PUBLICADOS de /blog y
 * /observatorio. Los borradores no pueden entrar aquí ni por error —
 * `listarSlugsPublicados` consulta como rol `anon` y la política RLS
 * `articles_select_published_or_team` filtra en Postgres.
 */
export const dynamic = 'force-static';
export const revalidate = 300;

function entrada(loc: string, lastmod: string, freq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

export async function GET() {
  const ahora = new Date().toISOString();

  const estaticas = rutasPublicas.map((ruta) => {
    const loc = ruta === '/' ? site.urlBase : `${site.urlBase}${ruta}`;
    return entrada(
      loc,
      ahora,
      ruta === '/' ? 'daily' : 'weekly',
      ruta === '/' ? '1.0' : '0.8',
    );
  });

  const [categorias, articulos, paginas, manifiesto] = await Promise.all([
    listarCategorias(),
    listarSlugsPublicados(),
    paginasParaSitemap(),
    manifiestoParaSitemap(),
  ]);

  const hayEditorial = articulos.some((a) => a.source_type === 'editorial');
  const hayObservatorio = articulos.some((a) => a.source_type === 'observatorio');

  const deCategorias = categorias.flatMap((c) => [
    ...(hayEditorial ? [entrada(`${site.urlBase}/blog/${c.slug}`, ahora, 'weekly', '0.6')] : []),
    ...(hayObservatorio
      ? [entrada(`${site.urlBase}/observatorio/${c.slug}`, ahora, 'weekly', '0.6')]
      : []),
  ]);

  const deArticulos = articulos.map((a) => {
    const base = a.source_type === 'observatorio' ? '/observatorio' : '/blog';
    return entrada(
      `${site.urlBase}${base}/${a.slug}`,
      a.published_at ?? ahora,
      'monthly',
      '0.7',
    );
  });

  // Paginas del CMS (legales, estatutos...) y puntos del manifiesto. Ambas se
  // consultan como `anon`, asi que RLS decide que es publico: no puede colarse
  // un borrador aunque alguien olvide un filtro.
  const dePaginas = paginas.map((p) =>
    entrada(`${site.urlBase}${p.loc}`, p.lastmod ?? ahora, 'monthly', '0.5'),
  );
  const deManifiesto = manifiesto.map((m) =>
    entrada(`${site.urlBase}${m.loc}`, m.lastmod ?? ahora, 'monthly', '0.6'),
  );

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...estaticas, ...deCategorias, ...deArticulos].join('\n') +
    `\n</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
