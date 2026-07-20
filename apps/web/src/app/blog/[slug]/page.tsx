import type { Metadata } from 'next';
import { VistaSlug } from '@/components/blog/VistaSlug';
import {
  listarCategorias,
  listarSlugsPublicados,
  obtenerArticulo,
} from '@/lib/blog/consultas';
import { metadatosArticulo } from '@/lib/blog/seo';
import { metadatosPagina } from '@/lib/seo';

const DESCRIPCION =
  'Artículos técnicos y basados en datos sobre las áreas de gestión del país. Cada afirmación, con su fuente. Cada dato, verificado antes de publicarse.';

export const revalidate = 300;
/** Un slug que no se prerenderizó (artículo nuevo) se genera bajo demanda. */
export const dynamicParams = true;

/**
 * Prerenderiza categorías + artículos publicados de la sección editorial.
 * Los borradores NUNCA entran aquí: `listarSlugsPublicados` consulta como
 * `anon` y RLS solo devuelve `status='published'`.
 */
export async function generateStaticParams() {
  const [categorias, articulos] = await Promise.all([
    listarCategorias(),
    listarSlugsPublicados(),
  ]);
  return [
    ...categorias.map((c) => ({ slug: c.slug })),
    ...articulos
      .filter((a) => a.source_type === 'editorial')
      .map((a) => ({ slug: a.slug })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const categoria = (await listarCategorias()).find((c) => c.slug === slug);
  if (categoria) {
    return metadatosPagina({
      titulo: `${categoria.name} · Blog`,
      descripcion: `Análisis de Razón Común sobre ${categoria.name.toLowerCase()}. ${DESCRIPCION}`,
      ruta: `/blog/${categoria.slug}`,
    });
  }

  const articulo = await obtenerArticulo(slug);
  if (!articulo) {
    return metadatosPagina({
      titulo: 'Artículo no encontrado',
      descripcion: 'El artículo que buscas no existe o no está publicado.',
      ruta: `/blog/${slug}`,
      noindex: true,
    });
  }
  return metadatosArticulo(articulo, '/blog');
}

export default async function BlogSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <VistaSlug
      slug={slug}
      tipo="editorial"
      base="/blog"
      eyebrow="El blog de Razón Común"
      nombreSeccion="Blog"
      descripcionSeccion={DESCRIPCION}
    />
  );
}
