import Link from 'next/link';
import { EtiquetaCategoriaBlog } from './EtiquetaCategoriaBlog';
import { fechaCorta } from '@/lib/blog/consultas';
import { minutosLectura } from '@/lib/blog/markdown';
import type { ArticuloConRelaciones } from '@/lib/blog/tipos';

/**
 * Tarjeta del grid (.post del boceto blog.html):
 * imagen 16/10 con etiqueta superpuesta arriba-izquierda, título, extracto,
 * y meta "fecha · minutos" separados por un punto.
 */
export function TarjetaArticulo({
  articulo,
  base = '/blog',
}: {
  articulo: ArticuloConRelaciones;
  base?: string;
}) {
  return (
    <Link
      href={`${base}/${articulo.slug}`}
      className="group flex flex-col overflow-hidden rounded-tarjeta border border-linea bg-panel no-underline transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-[5px] hover:shadow-[0_20px_44px_rgba(27,61,156,.13)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {articulo.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={articulo.cover_image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-grad opacity-90" />
        )}
        {articulo.categoria && (
          <EtiquetaCategoriaBlog
            categoria={articulo.categoria}
            className="absolute left-[14px] top-[14px]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-[9px] px-[22px] pb-6 pt-[22px]">
        <h3 className="text-[18px] font-bold leading-[1.32] text-tinta">{articulo.title}</h3>
        {articulo.excerpt && <p className="flex-1 text-[14px] text-cuerpo">{articulo.excerpt}</p>}
        <div className="flex items-center gap-[10px] text-[12.5px] font-semibold text-gris">
          <span>{fechaCorta(articulo.published_at)}</span>
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-gris" />
          <span>{minutosLectura(articulo.body)} min</span>
        </div>
      </div>
    </Link>
  );
}
