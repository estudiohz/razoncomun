'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * Galería de la ficha: foto grande + tira de miniaturas.
 *
 * Las fotos son los mockups que Printful genera por variante (`files` de
 * tipo `preview`). Si el producto se creó con una sola vista solo habrá una
 * imagen: entonces la tira se oculta en vez de enseñar una miniatura suelta.
 */
export function Galeria({ imagenes, alt }: { imagenes: string[]; alt: string }) {
  // El reset al cambiar de variante lo hace el padre con `key`, no un
  // efecto sobre `imagenes`: ese array se construye en cada render, así que
  // un `useEffect([imagenes])` volvería a la primera foto continuamente.
  const [indice, setIndice] = useState(0);

  if (imagenes.length === 0) {
    return <div className="aspect-square rounded-tarjeta bg-fondo" />;
  }

  const actual = imagenes[Math.min(indice, imagenes.length - 1)];
  const mover = (paso: number) =>
    setIndice((i) => (i + paso + imagenes.length) % imagenes.length);

  return (
    <div>
      {/* `object-contain`, no `cover`: los mockups de Printful no son
          cuadrados y recortarlos deja el producto (y el logo) fuera de
          cuadro. Aquí manda ver la pieza entera, aunque sobre fondo. */}
      <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-fondo">
        <Image
          key={actual}
          src={actual}
          alt={alt}
          fill
          sizes="(max-width: 860px) 100vw, 50vw"
          className="object-contain p-4"
          priority
        />

        {imagenes.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-linea bg-white/90 text-[18px] font-bold text-titular shadow-sm transition-colors hover:border-titular"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Foto siguiente"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-linea bg-white/90 text-[18px] font-bold text-titular shadow-sm transition-colors hover:border-titular"
            >
              ›
            </button>
          </>
        )}
      </div>

      {imagenes.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-2.5" aria-label="Fotos del producto">
          {imagenes.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setIndice(i)}
                aria-label={`Ver foto ${i + 1} de ${imagenes.length}`}
                aria-current={i === indice}
                className={`relative block h-[72px] w-[72px] overflow-hidden rounded-[12px] bg-fondo transition-colors ${
                  i === indice ? 'ring-2 ring-accion' : 'ring-1 ring-linea hover:ring-titular'
                }`}
              >
                <Image src={src} alt="" fill sizes="72px" className="object-contain p-1.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
