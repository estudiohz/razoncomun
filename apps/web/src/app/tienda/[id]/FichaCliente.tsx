'use client';

import Image from 'next/image';
import { useState } from 'react';
import { formatoPrecio } from '@/lib/tienda/precios';
import type { ProductoDetalle } from '@/lib/tienda/tipos';
import { useCarrito } from '../CarritoProvider';

/**
 * Parte interactiva de la ficha: selector de variante (solo si hay más de
 * una, Sergio: "sencilla") y el único botón de la página.
 */
export function FichaCliente({ producto }: { producto: ProductoDetalle }) {
  const disponibles = producto.variantes.filter((v) => v.disponible);
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(disponibles[0]?.id ?? null);
  const { anadir } = useCarrito();

  const seleccionada = disponibles.find((v) => v.id === seleccionadaId) ?? null;
  const imagen = seleccionada?.imagen ?? producto.imagen;

  return (
    <div className="grid gap-8 min-[860px]:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-tarjeta bg-fondo">
        {imagen && (
          <Image
            src={imagen}
            alt={producto.nombre}
            fill
            sizes="(max-width: 860px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        )}
      </div>

      <div className="flex flex-col justify-center">
        <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.15] text-titular">
          {producto.nombre}
        </h1>

        {seleccionada && (
          <p className="mt-3 text-[24px] font-extrabold text-titular tabular-nums">
            {formatoPrecio(seleccionada.precioCents)}
          </p>
        )}

        {/* Selector solo cuando aporta algo: con una única variante sobra. */}
        {disponibles.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-gris">Elige tu opción</p>
            <div className="flex flex-wrap gap-2">
              {disponibles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSeleccionadaId(v.id)}
                  aria-pressed={v.id === seleccionadaId}
                  className={
                    v.id === seleccionadaId
                      ? 'rounded-boton border-2 border-accion bg-white px-4 py-2 text-[13.5px] font-bold text-titular'
                      : 'rounded-boton border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-cuerpo hover:border-titular'
                  }
                >
                  {v.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {disponibles.length === 0 ? (
          <p className="mt-8 rounded-boton bg-fondo px-4 py-3 text-[14px] text-cuerpo">
            Este producto no está disponible ahora mismo.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => seleccionada && anadir(seleccionada.id)}
            className="mt-8 w-full rounded-boton bg-accion px-6 py-3.5 text-[15px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5 min-[520px]:w-auto min-[520px]:self-start"
          >
            Añadir al carrito
          </button>
        )}

        <p className="mt-4 text-[12.5px] text-gris">
          Se fabrica bajo pedido. Envío a España; los gastos exactos se calculan al tramitar el pedido.
        </p>
      </div>
    </div>
  );
}
