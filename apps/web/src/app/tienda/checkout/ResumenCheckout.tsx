'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatoPrecio } from '@/lib/tienda/precios';
import { resolverCarritoAction, type CarritoResuelto } from '../actions';
import { useCarrito } from '../CarritoProvider';

/**
 * Paso 1 del checkout (Sergio: "checkout muy limpio"): repaso de lo que se
 * lleva y total, sin distracciones. El pago va después, en Stripe Checkout
 * alojado (D-T4) — esta pantalla nunca toca datos de tarjeta.
 *
 * Los importes los calcula el SERVIDOR contra Printful (D-T3); del navegador
 * solo salen ids y cantidades.
 */
export function ResumenCheckout() {
  const { items, cargado } = useCarrito();
  const [datos, setDatos] = useState<CarritoResuelto | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!cargado) return;
    let vigente = true;
    setCargando(true);
    resolverCarritoAction(items)
      .then((r) => vigente && setDatos(r))
      .catch(() => vigente && setDatos({ lineas: [], subtotalCents: 0, noDisponibles: [] }))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [cargado, items]);

  if (cargando) return <p className="text-[15px] text-gris">Cargando tu pedido…</p>;

  if (!datos || datos.lineas.length === 0) {
    return (
      <div className="rounded-tarjeta border border-linea bg-panel p-8 text-center">
        <p className="text-[15px] text-gris">No tienes nada en el carrito.</p>
        <Link href="/tienda" className="mt-3 inline-block text-[14px] font-bold text-titular">
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta border border-linea bg-panel p-6">
      <ul className="divide-y divide-linea">
        {datos.lineas.map((l) => (
          <li key={l.variante.id} className="flex items-baseline justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-bold text-titular">{l.productoNombre}</p>
              <p className="text-[12.5px] text-gris">
                {l.variante.nombre !== l.productoNombre ? `${l.variante.nombre} · ` : ''}
                {l.cantidad} × {formatoPrecio(l.variante.precioCents)}
              </p>
            </div>
            <span className="shrink-0 text-[14.5px] font-bold text-titular tabular-nums">
              {formatoPrecio(l.totalLineaCents)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between border-t border-linea pt-4">
        <span className="text-[15px] font-bold text-cuerpo">Subtotal</span>
        <span className="text-[19px] font-extrabold text-titular tabular-nums">
          {formatoPrecio(datos.subtotalCents)}
        </span>
      </div>
      <p className="mt-1 text-[12.5px] text-gris">
        Falta sumar el envío, que depende de tu código postal.
      </p>

      {/* T2 sustituye este bloque por: país + CP -> tarifa real de Printful ->
          sesión de Stripe Checkout. Hasta entonces se dice la verdad en vez
          de enseñar un botón que no cobraría nada. */}
      <div className="mt-6 rounded-boton bg-fondo px-4 py-3">
        <p className="text-[13.5px] text-cuerpo">
          El pago online se activa en los próximos días. Si quieres reservar tu pedido, escríbenos y lo
          gestionamos a mano.
        </p>
      </div>

      <Link
        href="/tienda"
        className="mt-6 inline-block text-[13.5px] font-bold text-gris no-underline hover:text-titular"
      >
        ← Seguir mirando
      </Link>
    </div>
  );
}
