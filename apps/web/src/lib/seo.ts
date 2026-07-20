import type { Metadata } from 'next';
import { site } from './site';

/**
 * Genera metadatos por ruta con Open Graph coherente.
 * La imagen OG por defecto es el poster de personas del hero.
 */
export function metadatosPagina({
  titulo,
  descripcion,
  ruta,
  imagen = '/personas-poster-teal.jpg',
  noindex = false,
}: {
  titulo: string;
  descripcion: string;
  ruta: string;
  imagen?: string;
  noindex?: boolean;
}): Metadata {
  const url = ruta === '/' ? site.urlBase : `${site.urlBase}${ruta}`;
  const tituloCompleto =
    ruta === '/' ? `${site.nombre} — ${site.subtitulo}` : `${titulo} — ${site.nombre}`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'es_ES',
      siteName: site.nombre,
      url,
      title: tituloCompleto,
      description: descripcion,
      images: [{ url: imagen, width: 1200, height: 630, alt: site.nombre }],
    },
    twitter: {
      card: 'summary_large_image',
      title: tituloCompleto,
      description: descripcion,
      images: [imagen],
    },
  };
}

/** JSON-LD de organización política para el <head> del layout raíz. */
export function jsonLdOrganizacion() {
  return {
    '@context': 'https://schema.org',
    '@type': 'PoliticalParty',
    name: site.nombre,
    alternateName: 'RC',
    url: site.urlBase,
    logo: `${site.urlBase}/logo-rc.png`,
    slogan: site.lema,
    description: site.descripcion,
    sameAs: [
      'https://x.com/razoncomun',
      'https://www.instagram.com/razoncomun',
      'https://www.youtube.com/@razoncomun',
      'https://www.facebook.com/razoncomun',
      'https://www.linkedin.com/company/razoncomun',
      'https://www.tiktok.com/@razoncomun',
      site.discord,
    ],
  };
}
