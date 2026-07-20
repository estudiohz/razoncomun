import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
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
 * Ficha de artículo — fiel a `bocetos-home/blog-articulo.html`:
 * migas > cabecera centrada (etiqueta, h1, subtítulo, meta con avatar) >
 * imagen hero 21/9 > rejilla 75% artículo / 25% sidebar sticky.
 *
 * La usan /blog/[slug] y /observatorio/[slug] sin cambios.
 */
export function FichaArticulo({
  articulo,
  relacionados,
  base = '/blog',
  nombreSeccion = 'Blog',
}: {
  articulo: ArticuloConRelaciones;
  relacionados: ArticuloConRelaciones[];
  base?: string;
  nombreSeccion?: string;
}) {
  const { html, indice } = renderizarMarkdown(articulo.body);
  const sello = selloTrazabilidad(articulo);
  const url = `${site.urlBase}${base}/${articulo.slug}`;

  return (
    <>
      <Contenedor>
        <nav
          className="pt-6 text-[13px] font-semibold text-gris"
          aria-label="Ruta de navegación"
        >
          <Link href={base} className="no-underline hover:text-titular">
            {nombreSeccion}
          </Link>
          {articulo.categoria && (
            <>
              {' › '}
              <Link
                href={`${base}/${articulo.categoria.slug}`}
                className="no-underline hover:text-titular"
              >
                {articulo.categoria.name}
              </Link>
            </>
          )}
          {' › '}
          <span>{articulo.title}</span>
        </nav>
      </Contenedor>

      <Contenedor as="header">
        <div className="mx-auto max-w-[820px] pb-2 pt-[26px] text-center">
          {articulo.categoria && <EtiquetaCategoriaBlog categoria={articulo.categoria} />}
          <h1 className="my-[18px] mt-4 text-[clamp(28px,3.8vw,44px)] font-extrabold leading-[1.16] text-tinta">
            {articulo.title}
          </h1>
          {articulo.excerpt && (
            <p className="mx-auto max-w-[60ch] text-[18px] text-cuerpo">{articulo.excerpt}</p>
          )}
          <div className="mt-[22px] flex flex-wrap items-center justify-center gap-3 text-[13.5px] font-semibold text-gris">
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
      </Contenedor>

      {articulo.cover_image && (
        <div className="mx-auto mt-[34px] max-w-[1100px] overflow-hidden rounded-[22px] px-8 shadow-none min-[1164px]:px-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={articulo.cover_image}
            alt=""
            className="aspect-[21/9] w-full rounded-[22px] object-cover shadow-[0_24px_60px_rgba(27,61,156,.12)]"
          />
        </div>
      )}

      <div className="mx-auto mt-[52px] grid max-w-[1200px] grid-cols-1 gap-10 px-8 min-[981px]:grid-cols-[75%_25%] min-[981px]:gap-0">
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
