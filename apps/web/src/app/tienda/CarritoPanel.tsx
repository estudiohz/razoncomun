'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatoPrecio } from '@/lib/tienda/precios';
import { resolverCarritoAction, type CarritoResuelto } from './actions';
import { useCarrito } from './CarritoProvider';

/**
 * Carrito como panel lateral, no como página (Sergio: "carrito muy limpio"):
 * se abre encima, se cierra y no se pierde nada — vive en localStorage.
 *
 * Los precios se piden al servidor cada vez que se abre (D-T3): lo que hay
 * en el navegador son solo ids y cantidades.
 *
 * Portal a <body> por la lección del burger móvil: un contenedor con
 * `backdrop-blur` crea containing block y rompe `position: fixed`.
 */
export function CarritoPanel() {
  const { items, abierto, cerrar, cambiarCantidad, quitar } = useCarrito();
  const [montado, setMontado] = useState(false);
  const [datos, setDatos] = useState<CarritoResuelto | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCargando(true);
    resolverCarritoAction(items)
      .then((r) => vigente && setDatos(r))
      .catch(() => vigente && setDatos({ lineas: [], subtotalCents: 0, noDisponibles: [] }))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [abierto, items]);

  // Escape cierra, y mientras está abierto no se hace scroll detrás.
  useEffect(() => {
    if (!abierto) return;
    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar();
    }
    window.addEventListener('keydown', alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, cerrar]);

  if (!abierto || !montado) return null;

  const vacio = !cargando && (datos?.lineas.length ?? 0) === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-noche/40"
      role="dialog"
      aria-modal="true"
      aria-label="Carrito"
      onClick={cerrar}
    >
      <aside
        className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-nav motion-safe:animate-[entraDerecha_.25s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-linea px-5 py-4">
          <h2 className="text-[17px] font-extrabold text-titular">Tu carrito</h2>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar carrito"
            className="rounded-full px-2 py-1 text-[20px] leading-none text-gris hover:text-titular"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando && <p className="text-[14px] text-gris">Cargando…</p>}

          {vacio && (
            <div className="py-12 text-center">
              <p className="text-[15px] text-gris">Tu carrito está vacío.</p>
              <Link href="/tienda" onClick={cerrar} className="mt-3 inline-block text-[14px] font-bold text-titular">
                Ver productos
              </Link>
            </div>
          )}

          {(datos?.noDisponibles.length ?? 0) > 0 && (
            <p className="mb-4 rounded-boton bg-fondo px-3 py-2 text-[13px] text-cuerpo">
              Algún artículo ya no está disponible y se ha quitado del total.
            </p>
          )}

          <ul className="space-y-4">
            {(datos?.lineas ?? []).map((l) => (
              <li key={l.variante.id} className="flex gap-3">
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-boton bg-fondo">
                  {l.variante.imagen && (
                    <Image
                      src={l.variante.imagen}
                      alt=""
                      fill
                      sizes="72px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-titular">{l.productoNombre}</p>
                  {l.variante.nombre !== l.productoNombre && (
                    <p className="truncate text-[12.5px] text-gris">{l.variante.nombre}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-linea px-2 py-1">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(l.variante.id, l.cantidad - 1)}
                        aria-label={`Quitar una unidad de ${l.productoNombre}`}
                        className="px-1 text-[15px] leading-none text-gris hover:text-titular"
                      >
                        −
                      </button>
                      <span className="min-w-[18px] text-center text-[13px] font-bold tabular-nums">{l.cantidad}</span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(l.variante.id, l.cantidad + 1)}
                        aria-label={`Añadir una unidad de ${l.productoNombre}`}
                        className="px-1 text-[15px] leading-none text-gris hover:text-titular"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(l.variante.id)}
                      className="text-[12px] text-gris underline-offset-2 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
                <p className="shrink-0 text-[14px] font-bold text-titular tabular-nums">
                  {formatoPrecio(l.totalLineaCents)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {!vacio && (
          <footer className="border-t border-linea px-5 py-4">
            <div className="flex items-center justify-between text-[15px]">
              <span className="font-bold text-cuerpo">Subtotal</span>
              <span className="font-extrabold text-titular tabular-nums">
                {formatoPrecio(datos?.subtotalCents ?? 0)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-gris">Los gastos de envío se calculan en el siguiente paso.</p>
            <Link
              href="/tienda/checkout"
              onClick={cerrar}
              className="mt-4 block w-full rounded-boton bg-accion px-6 py-3 text-center text-[15px] font-bold text-white no-underline shadow-boton transition-transform hover:-translate-y-0.5"
            >
              Tramitar pedido
            </Link>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
