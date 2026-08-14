'use client';

import { useCarrito } from './CarritoProvider';

/** Icono del carrito con el contador. Único acceso al panel (D-T2). */
export function BotonCarrito() {
  const { totalArticulos, abrir, cargado } = useCarrito();

  return (
    <button
      type="button"
      onClick={abrir}
      className="relative inline-flex items-center gap-2 rounded-boton border border-linea bg-white px-4 py-2 text-[14px] font-bold text-titular transition-colors hover:border-titular"
      aria-label={`Abrir carrito${cargado && totalArticulos > 0 ? ` (${totalArticulos} artículos)` : ''}`}
    >
      <span aria-hidden>🛒</span>
      <span className="hidden sm:inline">Carrito</span>
      {/* `cargado` evita que el contador parpadee de 0 al número real: en SSR
          aún no se ha leído localStorage. */}
      {cargado && totalArticulos > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accion px-1 text-[11px] font-extrabold text-white">
          {totalArticulos}
        </span>
      )}
    </button>
  );
}
