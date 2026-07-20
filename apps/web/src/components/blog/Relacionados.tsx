import Link from 'next/link';
import type { ArticuloConRelaciones } from '@/lib/blog/tipos';

/** Bloque "Relacionados" del sidebar (.rel del boceto): miniatura 64x52 + título. */
export function Relacionados({
  articulos,
  base = '/blog',
}: {
  articulos: ArticuloConRelaciones[];
  base?: string;
}) {
  if (!articulos.length) return null;

  return (
    <section className="rounded-[16px] border border-linea bg-panel p-6">
      <h2 className="mb-4 text-[13px] font-extrabold uppercase tracking-[.08em] text-gris">
        Relacionados
      </h2>
      {articulos.map((a, i) => (
        <Link
          key={a.slug}
          href={`${base}/${a.slug}`}
          className={`group flex gap-3 py-[11px] no-underline ${
            i === 0 ? 'pt-0' : 'border-t border-linea'
          }`}
        >
          {a.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.cover_image}
              alt=""
              className="h-[52px] w-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="h-[52px] w-16 shrink-0 rounded-lg bg-grad" />
          )}
          <span className="text-[13.5px] font-semibold leading-[1.35] text-tinta group-hover:text-titular">
            {a.title}
          </span>
        </Link>
      ))}
    </section>
  );
}
