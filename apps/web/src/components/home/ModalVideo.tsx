'use client';

import { useEffect, useState } from 'react';

/**
 * Carátula con play que abre el vídeo destacado (10/09/2026) en un modal,
 * SIN sacar a nadie de la web — es justo el punto de tener un vídeo propio
 * en vez de un enlace a Instagram/YouTube: mantiene a quien llega en la
 * portada.
 *
 * El iframe de YouTube solo se monta al pulsar play, nunca antes: así no
 * carga ningún script de YouTube (ni sus cookies) en cada visita a la home,
 * solo para quien de verdad decide ver el vídeo. Coherente con la regla del
 * aviso de cookies — un iframe embed.js no dispara el mismo aviso que
 * Analytics/Meta, pero igualmente no hay razón para pagarlo si nadie lo pide.
 *
 * FORMATO 9:16 (Sergio, 10/09/2026): el vídeo destacado es un Short/Reel, no
 * un vídeo horizontal. La tarjeta ya NO fija su ancho al de la columna del
 * grid (como los artículos): fija su ALTO al de la fila —la misma altura que
 * las tarjetas de blog vecinas, vía `align-items: stretch` del grid, que es
 * el comportamiento por defecto— y deriva el ancho de `aspect-[9/16]`, con
 * `justify-self-center` para que no intente además estirarse a lo ancho. El
 * resultado es una tarjeta vertical y más estrecha que sus vecinas, pero de
 * la MISMA altura — "el mismo tamaño que una tarjeta del blog" sin que el
 * grid entero se dispare de alto (un 9:16 a todo el ancho de columna sería
 * casi el doble de alto que una tarjeta de blog real).
 *
 * En móvil (`grid-cols-1`, una tarjeta por fila) no hay fila que compartir,
 * así que se vuelve al patrón normal: ancho completo y alto derivado del
 * ratio — que es exactamente como se ve un Short a pantalla completa.
 */
export function ModalVideo({
  youtubeId,
  caratula,
  titulo,
}: {
  youtubeId: string;
  caratula: string | null;
  titulo: string;
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    function alPulsarEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', alPulsarEscape);
    return () => window.removeEventListener('keydown', alPulsarEscape);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Reproducir vídeo: ${titulo}`}
        className="group relative flex aspect-[9/16] h-full w-auto justify-self-center flex-col overflow-hidden rounded-tarjeta border border-linea bg-titular text-left no-underline transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1 hover:shadow-tarjeta max-[960px]:h-auto max-[960px]:w-full max-[960px]:justify-self-stretch"
      >
        {caratula ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={caratula} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110">
            {/* Triángulo de play dibujado a mano: sin icono externo, sin dependencia. */}
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-titular" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span className="relative mt-auto px-6 pb-[22px] pt-10 text-[15px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]">
          {titulo}
        </span>
      </button>

      {abierto ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="aspect-[9/16] h-[85vh] max-h-[85vh] w-auto max-w-[92vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1`}
              title={titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full rounded-[10px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar vídeo"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}
