'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatoPrecio } from '@/lib/tienda/precios';
import type { ProductoDetalle } from '@/lib/tienda/tipos';
import { useCarrito } from '../CarritoProvider';
import { Galeria } from './Galeria';

const MAX_POR_LINEA = 20;

/**
 * Ficha editable del producto (0052), con el HTML YA SANEADO en el servidor
 * (page.tsx). Aquí no se sanea nada: este componente corre en el navegador.
 */
export interface FichaEditable {
  descripcionHtml: string;
  guiaTallasHtml: string;
  plazoEntrega: string;
  fotosExtra: string[];
}

/**
 * Parte interactiva de la ficha: galería, selector de variante (solo si hay
 * más de una, Sergio: "sencilla"), cantidad y el único botón de la página.
 */
export function FichaCliente({
  producto,
  ficha,
}: {
  producto: ProductoDetalle;
  ficha: FichaEditable;
}) {
  const disponibles = producto.variantes.filter((v) => v.disponible);
  const [seleccionadaId, setSeleccionadaId] = useState<number | null>(disponibles[0]?.id ?? null);
  const [cantidad, setCantidad] = useState(1);
  const { anadir } = useCarrito();

  const seleccionada = disponibles.find((v) => v.id === seleccionadaId) ?? null;
  // Mockups de Printful primero y fotos de uso después: la foto de producto
  // identifica, la de uso convence, pero quien llega quiere ver el producto.
  const mockups = seleccionada?.imagenes ?? (producto.imagen ? [producto.imagen] : []);
  const imagenes = [...new Set([...mockups, ...ficha.fotosExtra])];

  return (
    <div className="grid gap-8 min-[860px]:grid-cols-2 min-[860px]:gap-12">
      {/* `key`: al cambiar de variante la galería se remonta y vuelve a la
          primera foto de la variante nueva. */}
      <Galeria key={seleccionada?.id ?? 'unica'} imagenes={imagenes} alt={producto.nombre} />

      <div className="flex flex-col justify-center">
        <h1 className="text-[clamp(24px,3vw,34px)] font-extrabold leading-[1.15] text-titular">
          {producto.nombre}
        </h1>

        {seleccionada && (
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-[24px] font-extrabold text-titular tabular-nums">
              {formatoPrecio(seleccionada.precioCents)}
            </span>
            <span className="text-[13px] text-gris">envío aparte</span>
          </p>
        )}

        {ficha.descripcionHtml && (
          <div
            className="prose-rc mt-6 text-[15px] leading-[1.6] text-cuerpo"
            dangerouslySetInnerHTML={{ __html: ficha.descripcionHtml }}
          />
        )}

        {ficha.guiaTallasHtml && (
          <details className="mt-5 rounded-[14px] border border-linea bg-white px-4 py-3">
            <summary className="cursor-pointer text-[14px] font-bold text-titular">
              Guía de tallas
            </summary>
            <div
              className="prose-rc mt-3 text-[14px] leading-[1.55] text-cuerpo"
              dangerouslySetInnerHTML={{ __html: ficha.guiaTallasHtml }}
            />
          </details>
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
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-boton border border-linea bg-white p-1">
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                disabled={cantidad <= 1}
                aria-label="Quitar una unidad"
                className="h-10 w-10 rounded-[10px] text-[18px] font-bold text-titular transition-colors hover:bg-fondo disabled:opacity-35"
              >
                −
              </button>
              <span aria-live="polite" className="w-8 text-center text-[15px] font-bold tabular-nums">
                {cantidad}
              </span>
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.min(MAX_POR_LINEA, c + 1))}
                disabled={cantidad >= MAX_POR_LINEA}
                aria-label="Añadir una unidad"
                className="h-10 w-10 rounded-[10px] text-[18px] font-bold text-titular transition-colors hover:bg-fondo disabled:opacity-35"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={() => seleccionada && anadir(seleccionada.id, cantidad)}
              className="flex-1 rounded-boton bg-accion px-6 py-3.5 text-[15px] font-bold text-white shadow-boton transition-transform hover:-translate-y-0.5 min-[520px]:flex-none"
            >
              Añadir al carrito
            </button>
          </div>
        )}

        <p className="mt-4 text-[14.5px] text-cuerpo">
          Se fabrica bajo pedido{ficha.plazoEntrega ? `: ${ficha.plazoEntrega}` : ''}. Envío a
          España; los gastos exactos se calculan al tramitar el pedido.
        </p>

        {/* Aviso de autofinanciación (Sergio, 31/08/2026): la tienda no es
            negocio, es financiación del partido — y eso hay que decirlo
            donde se decide la compra, no solo en /cuentas. */}
        <p className="mt-3 rounded-[14px] border border-linea bg-panel px-4 py-3 text-[14px] leading-[1.5] text-cuerpo">
          Todos nuestros productos son para la autofinanciación. Queda reflejado en la sección de{' '}
          <Link href="/cuentas" className="font-bold text-titular underline underline-offset-2">
            cuentas
          </Link>
          .
        </p>

        <ul className="mt-5 grid gap-2 text-[13.5px] text-gris">
          <li className="flex gap-2">
            <span aria-hidden>🔒</span> El pago va por Stripe: no tocamos tu tarjeta.
          </li>
          <li className="flex gap-2">
            <span aria-hidden>🖨️</span> Impresión bajo pedido: sin stock y sin excedentes.
          </li>
          <li className="flex gap-2">
            <span aria-hidden>📦</span> Portes reales de Printful según tu código postal, sin recargo.
          </li>
        </ul>
      </div>
    </div>
  );
}
