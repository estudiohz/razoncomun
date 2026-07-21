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
  discord: 'https://discord.gg/yxPNMsSy',
} as const;

/**
 * Redes sociales oficiales (enlaces reales verificados sobre el WordPress).
 * Fuente única: se consumen desde el menú móvil y de donde haga falta.
 * `icono` es un slug; el SVG inline correspondiente vive en
 * `components/layout/iconos-redes.tsx` (nada de fuentes de iconos ni CDN).
 */
export const redesSociales = [
  { nombre: 'X', href: 'https://x.com/RazonComunES', icono: 'x', aria: 'Síguenos en X' },
  {
    nombre: 'Instagram',
    href: 'https://www.instagram.com/razoncomun/',
    icono: 'instagram',
    aria: 'Síguenos en Instagram',
  },
  {
    nombre: 'YouTube',
    href: 'https://www.youtube.com/channel/UCpjkZGKZw3P1VQFGO7mNsSw',
    icono: 'youtube',
    aria: 'Suscríbete en YouTube',
  },
  {
    nombre: 'Facebook',
    href: 'https://www.facebook.com/people/Raz%C3%B3n-Com%C3%BAn/61577323931811/',
    icono: 'facebook',
    aria: 'Síguenos en Facebook',
  },
  {
    nombre: 'LinkedIn',
    href: 'https://www.linkedin.com/showcase/raz%C3%B3n-com%C3%BAn/',
    icono: 'linkedin',
    aria: 'Síguenos en LinkedIn',
  },
  {
    nombre: 'TikTok',
    href: 'https://www.tiktok.com/@razoncomun',
    icono: 'tiktok',
    aria: 'Síguenos en TikTok',
  },
  { nombre: 'Discord', href: site.discord, icono: 'discord', aria: 'Únete a nuestro Discord' },
] as const;

export type RedSocial = (typeof redesSociales)[number];

/** Navegación principal (nav flotante). */
export const navPrincipal = [
  { label: 'Manifiesto', href: '/manifiesto' },
  { label: 'Programa', href: '/programa' },
  { label: 'El País', href: '/pais' },
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
  '/pais',
  '/observatorio',
  '/blog',
  '/pregunta',
  '/cuentas',
  '/afiliate',
] as const;
