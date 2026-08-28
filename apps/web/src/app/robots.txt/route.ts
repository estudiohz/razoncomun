import { site } from '@/lib/site';
import { entornoCerrado } from '@/lib/entorno';

/** robots.txt como route handler. Bloquea rutas privadas, apunta al sitemap. */
// Deja de ser estático: depende de la variable de entorno.
export const dynamic = 'force-dynamic';

export function GET() {
  // En un entorno cerrado no se indexa NADA, y no se anuncia el sitemap: seria
  // darle a los buscadores el mapa completo de lo que no deben rastrear.
  if (entornoCerrado()) {
    return new Response(['User-agent: *', 'Disallow: /', ''].join('\n'), {
      headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const cuerpo = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /perfil',
    'Disallow: /entrar',
    'Disallow: /registro',
    'Disallow: /recuperar',
    'Disallow: /auth',
    'Disallow: /propuestas',
    'Disallow: /votaciones',
    '',
    `Sitemap: ${site.urlBase}/sitemap.xml`,
    `Host: ${site.urlBase}`,
    '',
  ].join('\n');

  return new Response(cuerpo, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
