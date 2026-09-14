'use client';

import Image from 'next/image';

/**
 * Logo del nav — hace de enlace a inicio Y de "recargar" (Sergio, 14/09/2026:
 * "haz que el propio logo sea ese icono de actualizar y quita el que
 * pusimos"). Sustituye al botón de recarga aparte (BotonRecargar) que se
 * había añadido junto a la campanita.
 *
 * `window.location.href` y no un <Link>: una navegación de Next.js (aunque
 * sea a la misma "/") reutiliza el bundle JS ya cargado — si lo que está
 * desactualizado es justo ese bundle (el caso real que motivó el botón: la
 * app instalada en iOS no tiene pull-to-refresh), un Link no lo arregla. Una
 * navegación de navegador de verdad sí.
 */
export function LogoNav({ nombre }: { nombre: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = '/';
      }}
      className="flex items-center gap-3"
      aria-label={`${nombre} — recargar e ir a inicio`}
    >
      <Image
        src="/logo-rc.svg"
        alt={nombre}
        width={210}
        height={47}
        priority
        unoptimized
        className="h-[47px] w-auto"
      />
    </button>
  );
}
