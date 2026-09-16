/** Configuración global del sitio. Fuente única de verdad para URLs, nav y SEO. */

export const site = {
  nombre: 'Razón Común',
  // SIN "www" (Óscar, 16/09/2026: "las noticias no salen posicionadas ni
  // salen en Google"). El servidor real redirige www -> sin-www con 301,
  // pero `urlBase` seguía apuntando a www: cada canonical, og:url, JSON-LD y
  // entrada del sitemap del sitio ENTERO apuntaba a una URL que redirige a
  // otra distinta. Google no indexa bien una canónica que a su vez
  // redirige — es exactamente la señal contradictoria que hunde el
  // posicionamiento, no solo del blog, de todas las páginas. Un solo sitio:
  // el que de verdad sirve 200 gana la canonicalización.
  urlBase: 'https://razoncomun.com',
  lema: 'La coherencia no tiene ideología',
  subtitulo: 'La alternativa que estabas esperando',
  descripcion:
    'Partido político español basado en datos y evidencia. Cada propuesta se mide, se simula y se corrige. Sin ideología: coherencia y resultados.',
  registro:
    'Partido político inscrito en el Registro del Ministerio del Interior.',
  // Enlace de reserva (footer, menú, SEO) — "Caduca: Nunca" / "Sin límite"
  // de usos, confirmado con la API de Discord (16/09/2026). El botón de la
  // home usa el editable en /admin/portada (lib/home/discord.ts) y cae en
  // este mismo valor si esa fila está vacía.
  discord: 'https://discord.gg/F289cbCg6h',
  /** id del servidor, para el widget embebido (discord.com/widget?id=...). */
  discordServerId: '1306953689390514237',
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
    nombre: 'Bluesky',
    href: 'https://bsky.app/profile/razoncomun.bsky.social',
    icono: 'bluesky',
    aria: 'Síguenos en Bluesky',
  },
  { nombre: 'Discord', href: site.discord, icono: 'discord', aria: 'Únete a nuestro Discord' },
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
] as const;

export type RedSocial = (typeof redesSociales)[number];

/** Navegación principal (nav flotante). */
export const navPrincipal = [
  { label: 'Manifiesto', href: '/manifiesto' },
  { label: 'Programa', href: '/programa' },
  { label: 'El País', href: '/pais' },
  { label: 'Propuestas', href: '/propuestas' },
  { label: 'Blog', href: '/blog' },
  { label: 'Pregunta a la IA', href: '/pregunta' },
  // La tienda ya está montada (olas T0-T1, 14/08/2026), así que el
  // placeholder '#' pasa a su ruta real (Sergio). Sigue con `noindex` y
  // fuera de `rutasPublicas`/sitemap hasta el visto bueno legal de la
  // LO 8/2007 — ver docs/tecnico/tienda-printful.md (D-T10).
  { label: 'Tienda', href: '/tienda' },
] as const;

/** Enlaces del footer. */
// Enlaces fijos del footer que NO son páginas del CMS (los legales/estatutos
// salen de la tabla `pages` según sus checkboxes). Aquí solo lo externo/fijo.
export const navFooter = [
  // "Cuentas" baja del nav principal al footer (Sergio, 29/08/2026): la
  // transparencia de cuentas es un compromiso que hay que poder consultar,
  // pero no es una puerta de entrada — ocupaba sitio en la nav a costa de
  // lo que si capta. La pagina sigue viva y en el sitemap.
  { label: 'Cuentas', href: '/cuentas' },
  // "Únete" y ruta /unete (Sergio, 10/08/2026): la página de alta como socio pasa a
  // llamarse así en toda la web. /afiliate sigue vivo como redirección
  // permanente (next.config.mjs) para no romper enlaces ya publicados.
  { label: 'Únete', href: '/unete' },
  { label: 'Observatorio', href: '/observatorio' },
  // "Qué cambió" baja del nav al footer (Sergio, 02/08/2026): el bucle de
  // retorno promete consecuencias, y sin representación en el Congreso todavía
  // no hay ninguna que enseñar. Prometerlo desde la nav principal invita a
  // entrar esperando resultados que aún no existen. La página sigue viva y es
  // primera línea DENTRO de la app (menú inferior), que es donde la ve quien
  // ya participa y entiende el estado del proyecto. Volverá arriba cuando haya
  // algo que contar.
  { label: 'Qué cambió', href: '/cambios' },
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
  '/unete',
] as const;
