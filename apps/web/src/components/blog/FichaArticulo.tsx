import { EtiquetaCategoriaBlog } from './EtiquetaCategoriaBlog';
import { CuerpoArticulo } from './CuerpoArticulo';
import { IndiceArticulo } from './IndiceArticulo';
import { SelloTrazabilidad } from './SelloTrazabilidad';
import { Relacionados } from './Relacionados';
import { CtaAfiliacion } from './CtaAfiliacion';
import { Compartir } from './Compartir';
import { fechaLarga, selloTrazabilidad } from '@/lib/blog/consultas';
import { minutosLectura, renderizarMarkdown } from '@/lib/blog/markdown';
import { site } from '@/lib/site';
import type { ArticuloConRelaciones } from '@/lib/blog/tipos';

/**
 * Ficha de artículo — layout de blog clásico (rediseño D-022, decisión de Sergio,
 * referencia visual estilo nintenderos.com). Cabecera alineada a la IZQUIERDA y
 * a ancho completo, en este orden exacto:
 *
 *   etiqueta → título → entradilla → imagen destacada → metadatos → contenido
 *
 * Cambios respecto al diseño anterior (los 6 de Sergio):
 *  1. Sin migas de pan VISIBLES (se quitaron por estética). El `BreadcrumbList`
 *     JSON-LD SIGUE emitiéndose en `VistaSlug` (lib/blog/seo.ts → jsonLdArticulo):
 *     invisible para el usuario, presente para Google. No es un cambio de SEO.
 *  2-4. Etiqueta, título y entradilla a la izquierda y al 100% de ancho de la
 *     columna (antes centrados y estrechos).
 *  5. Metadatos (autor · fecha · lectura) DEBAJO de la imagen y ANTES del
 *     contenido (antes iban arriba, sobre la imagen y centrados).
 *
 * Se conserva el resto del sistema: rejilla 75/25 con índice lateral sticky,
 * relacionados, sello de trazabilidad y compartir. Colores por tokens (D-021,
 * ya AA); no se toca ningún color.
 *
 * La usan /blog/[slug] y /observatorio/[slug] sin cambios.
 */
export function FichaArticulo({
  articulo,
  relacionados,
  base = '/blog',
}: {
  articulo: ArticuloConRelaciones;
  relacionados: ArticuloConRelaciones[];
  base?: string;
  /** Aceptado por compatibilidad con las llamadas; ya no se muestra (las migas
   *  visibles se retiraron; el breadcrumb vive solo en el JSON-LD). */
  nombreSeccion?: string;
}) {
  const { html, indice } = renderizarMarkdown(articulo.body);
  const sello = selloTrazabilidad(articulo);
  const url = `${site.urlBase}${base}/${articulo.slug}`;

  return (
    <>
      {/* Cabecera a ancho de columna, alineada a la izquierda. Comparte el
          mismo contenedor (max-w-[1200px] px-8) que la rejilla de contenido de
          abajo para que etiqueta, título, entradilla, imagen, metadatos y cuerpo
          arranquen todos en el mismo margen izquierdo. */}
      <div className="mx-auto max-w-[1200px] px-8">
        <header className="pt-8 min-[981px]:pt-10">
          {articulo.categoria && <EtiquetaCategoriaBlog categoria={articulo.categoria} />}
          <h1 className="mt-4 text-[clamp(28px,3.8vw,44px)] font-extrabold leading-[1.16] text-tinta">
            {articulo.title}
          </h1>
          {articulo.excerpt && (
            <p className="mt-[18px] text-[18px] leading-[1.55] text-cuerpo">
              {articulo.excerpt}
            </p>
          )}
        </header>

        {articulo.cover_image && (
          <div className="mt-8 overflow-hidden rounded-[22px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={articulo.cover_image}
              alt=""
              className="aspect-[21/9] w-full object-cover shadow-[0_24px_60px_rgba(27,61,156,.12)]"
            />
          </div>
        )}

        {/* Metadatos: DEBAJO de la imagen destacada y ANTES del contenido,
            alineados a la izquierda. Línea inferior para separar del cuerpo. */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-linea pb-7 text-[13.5px] font-semibold text-gris">
          <span className="flex items-center gap-[9px]">
            <span aria-hidden className="h-[30px] w-[30px] rounded-full bg-grad" />
            {articulo.autor?.display_name ?? 'Redacción de Razón Común'}
          </span>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-gris" />
          <time dateTime={articulo.published_at ?? undefined}>
            {fechaLarga(articulo.published_at)}
          </time>
          <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-gris" />
          <span>{minutosLectura(articulo.body)} min de lectura</span>
        </div>
      </div>

      {/* Rejilla 75/25: artículo + sidebar sticky (se conserva). */}
      <div className="mx-auto mt-[40px] grid max-w-[1200px] grid-cols-1 gap-10 px-8 min-[981px]:grid-cols-[75%_25%] min-[981px]:gap-0">
        <article className="min-[981px]:pr-14">
          <CuerpoArticulo html={html} />
          <SelloTrazabilidad sello={sello} />
          <Compartir url={url} titulo={articulo.title} />
        </article>

        <aside>
          <div className="flex flex-col gap-[22px] min-[981px]:sticky min-[981px]:top-24">
            <IndiceArticulo entradas={indice} />
            <CtaAfiliacion />
            <Relacionados articulos={relacionados} base={base} />
          </div>
        </aside>
      </div>
    </>
  );
}
