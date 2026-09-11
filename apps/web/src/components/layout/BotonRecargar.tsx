'use client';

import { useState } from 'react';

/**
 * Recarga forzada, para la app instalada en el móvil (PWA).
 *
 * SÍNTOMA (Sergio, 11/09/2026): en modo standalone de iOS no hay barra de
 * navegador con la que hacer pull-to-refresh, y cerrar/reabrir la app
 * normalmente solo la trae de vuelta desde segundo plano (el sistema no la
 * relanza desde cero) — así que una página que se quedó con datos viejos en
 * memoria (o en la Router Cache de Next) puede no verse nunca actualizada
 * sin este botón.
 *
 * `window.location.reload()` y no `router.refresh()`: refresh() solo pide de
 * nuevo el árbol de Server Components de la ruta actual reutilizando el JS
 * ya cargado — si lo que está desactualizado es justo ESE bundle (por un
 * despliegue reciente, el caso real que lo motivó), sigue sirviendo el
 * viejo. Una recarga completa de verdad no tiene ese punto ciego.
 */
export function BotonRecargar() {
  const [girando, setGirando] = useState(false);

  return (
    <button
      type="button"
      aria-label="Recargar la app"
      title="Recargar"
      onClick={() => {
        setGirando(true);
        window.location.reload();
      }}
      className="grid h-10 w-10 place-items-center rounded-full border border-linea bg-white/60 text-cuerpo transition-colors hover:border-titular hover:text-titular"
    >
      <svg
        viewBox="0 0 24 24"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={girando ? 'animate-spin' : undefined}
        aria-hidden
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 4v5h-5" />
      </svg>
    </button>
  );
}
