import Link from 'next/link';
import { Contenedor } from '@/components/layout/Contenedor';
import { fechaCorta, listarArticulos } from '@/lib/blog/consultas';
import { leerVideoDestacado } from '@/lib/home/video-destacado';
import { ModalVideo } from './ModalVideo';

/**
 * "Actualidad" de la portada (10/09/2026, encargo de Sergio; antes "Lo
 * último del blog").
 *
 * Si hay un vídeo destacado configurado en `/admin/portada`, el tercer
 * hueco de la rejilla deja de ser un artículo y pasa a ser su carátula con
 * play (`ModalVideo`) — se piden solo 2 artículos en vez de 3. Sin vídeo
 * configurado, el comportamiento es EXACTAMENTE el de antes: 3 artículos.
 * Así nadie ve un hueco vacío el día que aún no se ha subido nada.
 *
 * Es un Server Component asíncrono: las dos consultas (artículos + vídeo)
 * corren en el servidor, así que no añaden JavaScript al navegador ni una
 * llamada extra desde el cliente. Los artículos pasan por las mismas
 * políticas RLS que el resto, de modo que un borrador o un artículo
 * PROGRAMADO al futuro (migración 0050) no puede colarse en la portada.
 *
 * Si no hay artículos NI vídeo, la sección no se pinta: mejor eso que un
 * hueco con tarjetas vacías.
 */
export async function FeedObservatorio() {
  const video = await leerVideoDestacado();
  const articulos = await listarArticulos({ tipo: 'editorial', limite: video ? 2 : 3 });

  if (articulos.length === 0 && !video) return null;

  return (
    <section className="pb-[90px] pt-[70px]">
      <Contenedor>
        <div className="mb-11 max-w-[60ch]">
          <h2 className="text-[clamp(28px,3.2vw,40px)] font-extrabold leading-[1.15]">
            Actualidad
          </h2>
          <p className="mt-3.5 text-base">
            Análisis generado a partir de fuentes oficiales y revisado por el equipo antes de
            publicarse. Siempre con la fuente enlazada.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-[18px] max-[960px]:grid-cols-1">
          {articulos.map((art) => (
            <Link
              key={art.slug}
              href={`/blog/${art.slug}`}
              className="group flex flex-col overflow-hidden rounded-tarjeta border border-linea bg-panel no-underline transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta"
            >
              {art.cover_image ? (
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* <img> plano, no next/image: las portadas viven en
                      api.razoncomun.com y ese host NO esta en `remotePatterns`
                      de next.config. Con <Image> la portada reventaria en
                      tiempo de ejecucion. Es lo mismo que hace el resto del
                      blog (ver Destacado.tsx). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={art.cover_image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col gap-2 px-6 pb-[26px] pt-[22px]">
                <span className="text-[12.5px] font-semibold text-gris">
                  {fechaCorta(art.published_at)}
                  {art.categoria ? ` · ${art.categoria.name.toUpperCase()}` : ''}
                </span>
                <h3 className="text-[17.5px] font-bold leading-[1.35]">{art.title}</h3>
                {art.excerpt ? <p className="flex-1 text-sm">{art.excerpt}</p> : <span className="flex-1" />}
                <span className="mt-1.5 text-sm font-bold text-titular">Leer análisis →</span>
              </div>
            </Link>
          ))}

          {video ? (
            <ModalVideo youtubeId={video.youtubeId} caratula={video.caratula} titulo="Vídeo destacado" />
          ) : null}
        </div>
      </Contenedor>
    </section>
  );
}
