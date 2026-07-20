import { site } from '@/lib/site';

/** robots.txt como route handler. Bloquea rutas privadas, apunta al sitemap. */
export const dynamic = 'force-static';

export function GET() {
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
