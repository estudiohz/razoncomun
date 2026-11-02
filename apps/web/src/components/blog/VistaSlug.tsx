import { notFound } from 'next/navigation';
import { PortadaBlog } from './PortadaBlog';
import { ListadoAuditoriasObservatorio } from '@/components/auditoria/BloqueAuditoriasObservatorio';
import { createClient } from '@/lib/supabase/server';
import { auditoriaAbierta, listarCasosPublicos } from '@/lib/vigia/publico';
import { FichaArticulo } from './FichaArticulo';
import {
  listarArticulos,
  listarCategorias,
  listarRelacionados,
  obtenerArticulo,
} from '@/lib/blog/consultas';
import { jsonLdArticulo } from '@/lib/blog/seo';

/**
 * Resolutor compartido de `/{seccion}/[slug]`.
 *
 * ¿Por qué una sola ruta dinámica para dos cosas? La misión pide a la vez
 * `/blog/[categoria]` y `/blog/[slug]`, y Next no admite dos segmentos
 * dinámicos hermanos en el mismo nivel. En lugar de meter un prefijo
 * artificial (`/blog/categoria/vivienda`) que ensuciaría las URLs, este
 * resolutor mira primero el catálogo de categorías y, si no hay coincidencia,
 * busca un artículo.
 *
 * Consecuencia a conocer: si un artículo tuviera el mismo slug que una
 * categoría, ganaría la categoría. El editor admin lo impide al validar.
 */
export async function VistaSlug({
  slug,
  tipo,
  base,
  eyebrow,
  nombreSeccion,
  descripcionSeccion,
}: {
  slug: string;
  tipo: 'editorial' | 'observatorio';
  base: string;
  eyebrow: string;
  nombreSeccion: string;
  descripcionSeccion: string;
}) {
  const categorias = await listarCategorias();
  const categoria = categorias.find((c) => c.slug === slug);

  // 1) Es una categoría → listado filtrado.
  if (categoria) {
    const [articulos, casos] = await Promise.all([
      listarArticulos({ tipo, categoriaSlug: categoria.slug }),
      // Casos de auditoría de esta categoría (0081): solo en el Observatorio.
      tipo === 'observatorio' && auditoriaAbierta()
        ? createClient()
            .then(listarCasosPublicos)
            .then((c) => c.filter((x) => x.category_id === categoria.id))
        : Promise.resolve([]),
    ]);
    return (
      <PortadaBlog
        eyebrow={eyebrow}
        titulo={categoria.name}
        descripcion={descripcionSeccion}
        articulos={articulos}
        categorias={categorias}
        categoriaActiva={categoria.slug}
        base={base}
        extra={casos.length ? <ListadoAuditoriasObservatorio casos={casos} /> : undefined}
      />
    );
  }

  // 2) Es un artículo publicado → ficha. Un borrador no llega hasta aquí:
  //    RLS no lo devuelve al rol anon, así que `obtenerArticulo` da null → 404.
  const articulo = await obtenerArticulo(slug);
  if (!articulo || articulo.source_type !== tipo) notFound();

  const relacionados = await listarRelacionados(articulo);

  return (
    <>
      {jsonLdArticulo(articulo, base).map((bloque, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(bloque) }}
        />
      ))}
      <FichaArticulo
        articulo={articulo}
        relacionados={relacionados}
        base={base}
        nombreSeccion={nombreSeccion}
      />
    </>
  );
}
