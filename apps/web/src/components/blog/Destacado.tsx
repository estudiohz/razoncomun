import Link from 'next/link';
import { EtiquetaCategoriaBlog } from './EtiquetaCategoriaBlog';
import { fechaLarga } from '@/lib/blog/consultas';
import { minutosLectura } from '@/lib/blog/markdown';
import type { ArticuloConRelaciones } from '@/lib/blog/tipos';

/**
 * Artículo destacado de portada (.destacado del boceto): rejilla 1.15fr/.85fr
 * con la imagen a la izquierda y el texto centrado verticalmente a la derecha.
 * En <=900px colapsa a una columna con la imagen de 240px de alto.
 */
export function Destacado({
  articulo,
  base = '/blog',
}: {
  articulo: ArticuloConRelaciones;
  base?: string;
}) {
  return (
    <article className="mb-11 grid grid-cols-1 overflow-hidden rounded-[24px] border border-linea bg-panel shadow-[0_20px_50px_rgba(27,61,156,.07)] min-[901px]:grid-cols-[1.15fr_.85fr]">
      <div className="relative min-h-[240px] overflow-hidden min-[901px]:min-h-[380px]">
        {articulo.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={articulo.cover_image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-grad" />
        )}
      </div>

      <div className="flex flex-col justify-center px-[26px] py-8 min-[901px]:px-[46px] min-[901px]:py-12">
        {articulo.categoria && (
          <div>
            <EtiquetaCategoriaBlog categoria={articulo.categoria} />
          </div>
        )}
        <h2 className="my-[14px] mt-4 text-[clamp(24px,2.6vw,34px)] font-extrabold leading-[1.18] text-tinta">
          <Link href={`${base}/${articulo.slug}`} className="no-underline hover:text-titular">
            {articulo.title}
          </Link>
        </h2>
        {articulo.excerpt && (
          <p className="mb-[22px] text-[15.5px] text-cuerpo">{articulo.excerpt}</p>
        )}
        <div className="text-[13px] font-semibold text-gris">
          {fechaLarga(articulo.published_at)} · {minutosLectura(articulo.body)} min de lectura
        </div>
      </div>
    </article>
  );
}
