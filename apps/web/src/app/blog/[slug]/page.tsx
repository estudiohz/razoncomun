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

/**
 * BUG URGENTE (Sergio, 15/09/2026): cualquier ficha de artículo daba 500
 * ("Application error"), general a todo el blog, viejos y nuevos por igual.
 *
 * CAUSA: esta ruta combinaba `generateStaticParams` + `export const
 * revalidate` (caché ISR) con el `Nav` del layout raíz, que lee las cookies
 * de sesión en CADA página para saber si pintar "Únete/Accede" o el menú de
 * usuario. Esa combinación es incompatible en Next: pedirle a la vez una
 * caché estática revalidable Y una API dinámica (cookies) en el árbol hace
 * que aborte con el digest `DYNAMIC_SERVER_USAGE` en cuanto la página no
 * tiene ya una copia servible de un build anterior — que es exactamente el
 * caso de un artículo recién publicado, o de CUALQUIERA tras un redeploy que
 * limpia la caché (el contenedor es nuevo). Por eso "pasaba con todo el
 * blog": no era el contenido de ningún artículo, era la ruta.
 *
 * ARREGLO: fuera `revalidate`, la ruta pasa a renderizar en cada petición
 * (mismo patrón que `/mes`, que ya usa `force-dynamic` por este mismo
 * motivo). Se pierde el beneficio de ISR en los artículos; se gana que
 * cargan siempre.
 */
export const dynamic = 'force-dynamic';
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
