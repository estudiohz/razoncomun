import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { aTextoPlano } from './markdown';
import type { ArticuloConRelaciones } from './tipos';

/**
 * SEO por artículo. Vive aparte de `@/lib/seo` (rc-04) porque necesita
 * `openGraph.type: 'article'` con fechas y sección — cosas que el helper
 * genérico `metadatosPagina` no modela. El resto de convenciones (canonical,
 * locale es_ES, twitter card) son idénticas a propósito.
 */

function descripcion(articulo: ArticuloConRelaciones): string {
  const texto = articulo.seo_desc || articulo.excerpt || aTextoPlano(articulo.body);
  return texto.length > 300 ? `${texto.slice(0, 297)}…` : texto;
}

function imagen(articulo: ArticuloConRelaciones): string {
  if (!articulo.cover_image) return `${site.urlBase}/personas-poster-teal.jpg`;
  return articulo.cover_image.startsWith('http')
    ? articulo.cover_image
    : `${site.urlBase}${articulo.cover_image}`;
}

export function metadatosArticulo(
  articulo: ArticuloConRelaciones,
  base = '/blog',
): Metadata {
  const url = `${site.urlBase}${base}/${articulo.slug}`;
  const titulo = articulo.seo_title || articulo.title;
  const desc = descripcion(articulo);
  const img = imagen(articulo);

  return {
    title: titulo,
    description: desc,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    authors: articulo.autor?.display_name
      ? [{ name: articulo.autor.display_name }]
      : [{ name: site.nombre }],
    openGraph: {
      type: 'article',
      locale: 'es_ES',
      siteName: site.nombre,
      url,
      title: titulo,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: articulo.title }],
      publishedTime: articulo.published_at ?? undefined,
      modifiedTime: articulo.published_at ?? articulo.created_at,
      section: articulo.categoria?.name,
      authors: articulo.autor?.display_name ? [articulo.autor.display_name] : [site.nombre],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: desc,
      images: [img],
    },
  };
}

/** JSON-LD schema.org/Article + BreadcrumbList para el `<head>` de la ficha. */
export function jsonLdArticulo(articulo: ArticuloConRelaciones, base = '/blog') {
  const url = `${site.urlBase}${base}/${articulo.slug}`;

  const articulo_ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: articulo.title,
    description: descripcion(articulo),
    image: [imagen(articulo)],
    datePublished: articulo.published_at ?? articulo.created_at,
    dateModified: articulo.published_at ?? articulo.created_at,
    inLanguage: 'es-ES',
    articleSection: articulo.categoria?.name,
    author: {
      '@type': articulo.autor?.display_name ? 'Person' : 'Organization',
      name: articulo.autor?.display_name ?? site.nombre,
    },
    publisher: {
      '@type': 'Organization',
      name: site.nombre,
      logo: { '@type': 'ImageObject', url: `${site.urlBase}/logo-rc.png` },
    },
    // Sello de trazabilidad, también legible por máquinas.
    citation: articulo.source_urls?.length ? articulo.source_urls : undefined,
  };

  const migas_ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: site.urlBase },
      {
        '@type': 'ListItem',
        position: 2,
        name: base === '/observatorio' ? 'Observatorio' : 'Blog',
        item: `${site.urlBase}${base}`,
      },
      { '@type': 'ListItem', position: 3, name: articulo.title, item: url },
    ],
  };

  return [articulo_ld, migas_ld];
}
