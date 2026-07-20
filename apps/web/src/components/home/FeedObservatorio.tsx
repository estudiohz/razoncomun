import Image from 'next/image';
import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { etiquetaCategoria, feedObservatorio } from '@/lib/mock';

/** Feed "Lo último del Observatorio" — 3 tarjetas de artículo (datos mock). */
export function FeedObservatorio() {
  return (
    <section className="pb-[90px] pt-[70px]">
      <Contenedor>
        <div className="mb-11 max-w-[60ch]">
          <h2 className="text-[clamp(28px,3.2vw,40px)] font-extrabold leading-[1.15]">
            Lo último del Observatorio
          </h2>
          <p className="mt-3.5 text-base">
            Análisis diario generado a partir de fuentes oficiales y revisado por el equipo antes de
            publicarse. Siempre con la fuente enlazada.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-[18px] max-[960px]:grid-cols-1">
          {feedObservatorio.map((art) => (
            <Link
              key={art.slug}
              href={`/observatorio/${art.slug}`}
              className="group flex flex-col overflow-hidden rounded-tarjeta border border-linea bg-panel no-underline transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={art.imagen}
                  alt={art.alt}
                  fill
                  sizes="(max-width: 960px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 px-6 pb-[26px] pt-[22px]">
                <span className="text-[12.5px] font-semibold text-gris">
                  {art.fecha} · {etiquetaCategoria[art.categoria].toUpperCase()}
                </span>
                <h3 className="text-[17.5px] font-bold leading-[1.35]">{art.titulo}</h3>
                <p className="flex-1 text-sm">{art.extracto}</p>
                <span className="mt-1.5 text-sm font-bold text-titular">Leer análisis →</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-[26px] text-[13.5px] text-gris">
          Contenido de ejemplo del boceto. En producción este feed se alimenta solo:{' '}
          <b className="text-titular">
            fuentes oficiales → redacción IA → revisión humana → publicación
          </b>
          .
        </p>
      </Contenedor>
    </section>
  );
}
