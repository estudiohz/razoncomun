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
  'Análisis diario a partir de fuentes oficiales (INE, Eurostat, BOE, Banco de España), traducido a lenguaje claro y verificado antes de publicarse.';

/**
 * Sin `revalidate` (ISR): la misma combinación con `generateStaticParams` y
 * el `Nav` del layout raíz (lee cookies en cada página) tumbaba con 500
 * ("DYNAMIC_SERVER_USAGE") las fichas de /blog/[slug] — ver el comentario
 * completo ahí. Se corrige aquí también porque comparte plantilla y el
 * mismo riesgo.
 */
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export async function generateStaticParams() {
  const [categorias, articulos] = await Promise.all([
    listarCategorias(),
    listarSlugsPublicados(),
  ]);
  return [
    ...categorias.map((c) => ({ slug: c.slug })),
    ...articulos
      .filter((a) => a.source_type === 'observatorio')
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
      titulo: `${categoria.name} · Observatorio`,
      descripcion: `Datos oficiales sobre ${categoria.name.toLowerCase()}. ${DESCRIPCION}`,
      ruta: `/observatorio/${categoria.slug}`,
    });
  }

  const articulo = await obtenerArticulo(slug);
  if (!articulo) {
    return metadatosPagina({
      titulo: 'Entrada no encontrada',
      descripcion: 'La entrada que buscas no existe o no está publicada.',
      ruta: `/observatorio/${slug}`,
      noindex: true,
    });
  }
  return metadatosArticulo(articulo, '/observatorio');
}

export default async function ObservatorioSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <VistaSlug
      slug={slug}
      tipo="observatorio"
      base="/observatorio"
      eyebrow="Observatorio"
      nombreSeccion="Observatorio"
      descripcionSeccion={DESCRIPCION}
    />
  );
}
