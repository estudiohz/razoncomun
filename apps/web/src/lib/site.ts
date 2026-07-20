/** Configuración global del sitio. Fuente única de verdad para URLs, nav y SEO. */

export const site = {
  nombre: 'Razón Común',
  urlBase: 'https://www.razoncomun.com',
  lema: 'La coherencia no tiene ideología',
  subtitulo: 'La alternativa que estabas esperando',
  descripcion:
    'Partido político español basado en datos y evidencia. Cada propuesta se mide, se simula y se corrige. Sin ideología: coherencia y resultados.',
  registro:
    'Partido político inscrito en el Registro del Ministerio del Interior.',
  discord: 'https://discord.gg/razoncomun',
} as const;

/** Navegación principal (nav flotante). */
export const navPrincipal = [
  { label: 'Manifiesto', href: '/manifiesto' },
  { label: 'Programa', href: '/programa' },
  { label: 'Observatorio', href: '/observatorio' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pregunta a la IA', href: '/pregunta' },
  { label: 'Cuentas', href: '/cuentas' },
] as const;

/** Enlaces del footer. */
export const navFooter = [
  { label: 'Estatutos', href: '/estatutos' },
  { label: 'Contacto', href: '/contacto' },
  { label: 'Discord', href: site.discord },
] as const;

/** Rutas públicas indexables → entran en sitemap.xml. */
export const rutasPublicas = [
  '/',
  '/manifiesto',
  '/programa',
  '/observatorio',
  '/blog',
  '/pregunta',
  '/cuentas',
  '/afiliate',
] as const;
