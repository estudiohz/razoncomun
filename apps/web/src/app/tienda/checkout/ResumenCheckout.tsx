'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { formatoPrecio } from '@/lib/tienda/precios';
import type { TarifaEnvio } from '@/lib/tienda/tipos';
import { resolverCarritoAction, type CarritoResuelto } from '../actions';
import { useCarrito } from '../CarritoProvider';
import { calcularEnvioAction, crearSesionPagoAction } from './actions';

/**
 * Checkout (Sergio: "muy limpio"): repaso de lo que se lleva, dirección,
 * envío real y pago. Los datos de tarjeta NUNCA pasan por aquí — el pago
 * ocurre en la página alojada de Stripe (D-T4).
 *
 * Todos los importes que se ven vienen del SERVIDOR (D-T3). Del navegador
 * solo salen ids, cantidades y la dirección.
 */

const etiqueta = 'mb-1 block text-[12px] font-bold uppercase tracking-[.06em] text-gris';
const campo =
  'w-full rounded-boton border border-linea bg-white px-4 py-2.5 text-[14.5px] text-cuerpo outline-none focus:border-titular';

/**
 * Aviso de artículos que ya no se pueden comprar, con salida directa.
 *
 * Antes de esto, un carrito con una línea agotada bloqueaba el pago para
 * siempre: el checkout no dejaba quitar nada y "Ir a pagar" solo devolvía
 * un error genérico ("algún producto ya no está disponible") sin decir cuál
 * ni cómo arreglarlo.
 */
function AvisoNoDisponibles({
  items,
  onQuitar,
}: {
  items: CarritoResuelto['noDisponibles'];
  onQuitar: (variantId: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6 rounded-tarjeta border border-magenta/40 bg-magenta/5 p-5">
      <p className="text-[14px] font-bold text-magenta">
        {items.length === 1 ? 'Un artículo ya no está disponible' : 'Algunos artículos ya no están disponibles'}
      </p>
      <p className="mt-1 text-[13px] text-cuerpo">Quítalos del carrito para poder pagar el resto.</p>
      <ul className="mt-3 grid gap-2">
        {items.map((i) => (
          <li key={i.variantId} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className="text-cuerpo">{i.nombre ?? 'Artículo ya no disponible'}</span>
            <button
              type="button"
              onClick={() => onQuitar(i.variantId)}
              className="shrink-0 rounded-boton border border-linea bg-white px-3 py-1.5 text-[12.5px] font-bold text-titular hover:border-magenta"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumenCheckout() {
  const { items, cargado, cambiarCantidad, quitar, vaciar } = useCarrito();
  const [datos, setDatos] = useState<CarritoResuelto | null>(null);
  const [cargando, setCargando] = useState(true);

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    direccion: '',
    codigoPostal: '',
    ciudad: '',
  });
  const [tarifas, setTarifas] = useState<TarifaEnvio[] | null>(null);
  const [tarifaId, setTarifaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculando, empezarCalculo] = useTransition();
  const [pagando, empezarPago] = useTransition();

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

  // Si cambia el carrito o la dirección, las tarifas calculadas dejan de
  // valer: obligar a recalcular evita pagar un envío que no corresponde.
  useEffect(() => {
    setTarifas(null);
    setTarifaId(null);
  }, [items, form.codigoPostal, form.ciudad]);

  const cambiar = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function calcular() {
    setError(null);
    empezarCalculo(async () => {
      const r = await calcularEnvioAction(items, {
        paisCodigo: 'ES',
        ciudad: form.ciudad,
        codigoPostal: form.codigoPostal,
      });
      if (!r.ok || !r.tarifas) return setError(r.error ?? 'No se ha podido calcular el envío.');
      setTarifas(r.tarifas);
      setTarifaId(r.tarifas[0]?.id ?? null);
    });
  }

  function pagar() {
    if (!tarifaId) return;
    setError(null);
    empezarPago(async () => {
      const r = await crearSesionPagoAction(items, form, tarifaId);
      if (!r.ok || !r.url) return setError(r.error ?? 'No se ha podido abrir el pago.');
      window.location.href = r.url;
    });
  }

  if (cargando) return <p className="text-[15px] text-gris">Cargando tu pedido…</p>;

  if (!datos || (datos.lineas.length === 0 && datos.noDisponibles.length === 0)) {
    return (
      <div className="rounded-tarjeta border border-linea bg-panel p-8 text-center">
        <p className="text-[15px] text-gris">No tienes nada en el carrito.</p>
        <Link href="/tienda" className="mt-3 inline-block text-[14px] font-bold text-titular">
          Ver productos
        </Link>
      </div>
    );
  }

  // Carrito con solo artículos agotados: no hay nada que pagar todavía, pero
  // sí hay algo que hacer — quitarlos —, así que no se manda directamente a
  // "ver productos" sin darle salida.
  if (datos.lineas.length === 0) {
    return (
      <div className="mx-auto max-w-[520px]">
        <AvisoNoDisponibles items={datos.noDisponibles} onQuitar={quitar} />
        <button
          type="button"
          onClick={vaciar}
          className="w-full rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular hover:border-titular"
        >
          Vaciar el carrito
        </button>
        <Link href="/tienda" className="mt-3 block text-center text-[14px] font-bold text-titular">
          ← Ver productos
        </Link>
      </div>
    );
  }

  const envio = tarifas?.find((t) => t.id === tarifaId) ?? null;
  const total = datos.subtotalCents + (envio?.precioCents ?? 0);

  return (
    <div className="grid gap-8 min-[900px]:grid-cols-[1fr_400px] min-[900px]:items-start">
      <div className="rounded-tarjeta border border-linea bg-white p-6">
        <AvisoNoDisponibles items={datos.noDisponibles} onQuitar={quitar} />

        <h2 className="text-[17px] font-extrabold text-titular">Tus datos</h2>

        <div className="mt-5 grid gap-4">
          <div>
            <label className={etiqueta} htmlFor="nombre">Nombre y apellidos</label>
            <input id="nombre" className={campo} value={form.nombre} onChange={cambiar('nombre')} autoComplete="name" />
          </div>
          <div>
            <label className={etiqueta} htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" className={campo} value={form.email} onChange={cambiar('email')} autoComplete="email" />
            <p className="mt-1.5 text-[12px] text-gris">Aquí te llegan el recibo y el seguimiento del envío.</p>
          </div>
          <div>
            <label className={etiqueta} htmlFor="direccion">Dirección</label>
            <input id="direccion" className={campo} value={form.direccion} onChange={cambiar('direccion')} autoComplete="street-address" placeholder="Calle, número, piso" />
          </div>
          <div className="grid gap-4 min-[520px]:grid-cols-[140px_1fr]">
            <div>
              <label className={etiqueta} htmlFor="cp">Código postal</label>
              <input id="cp" className={campo} value={form.codigoPostal} onChange={cambiar('codigoPostal')} inputMode="numeric" maxLength={5} autoComplete="postal-code" />
            </div>
            <div>
              <label className={etiqueta} htmlFor="ciudad">Ciudad</label>
              <input id="ciudad" className={campo} value={form.ciudad} onChange={cambiar('ciudad')} autoComplete="address-level2" />
            </div>
          </div>
          <p className="text-[12.5px] text-gris">De momento solo enviamos a España.</p>
        </div>

        <div className="mt-6 border-t border-linea pt-5">
          <h3 className="text-[15px] font-extrabold text-titular">Envío</h3>

          {!tarifas ? (
            <>
              <p className="mt-2 text-[13.5px] text-gris">
                Los portes los pone quien lo envía: escribe el código postal y los calculamos de verdad.
              </p>
              <button
                type="button"
                onClick={calcular}
                disabled={calculando}
                className="mt-4 rounded-boton border border-linea bg-white px-5 py-2.5 text-[14px] font-bold text-titular hover:border-titular disabled:opacity-60"
              >
                {calculando ? 'Calculando…' : 'Calcular envío'}
              </button>
            </>
          ) : (
            <ul className="mt-3 grid gap-2">
              {tarifas.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-boton border border-linea px-4 py-3 text-[14px] has-[:checked]:border-accion">
                    <input
                      type="radio"
                      name="tarifa"
                      value={t.id}
                      checked={t.id === tarifaId}
                      onChange={() => setTarifaId(t.id)}
                      className="h-[17px] w-[17px] accent-accion"
                    />
                    <span className="flex-1 text-cuerpo">
                      {t.nombre}
                      {t.diasMin !== null && t.diasMax !== null && (
                        <span className="text-gris"> · {t.diasMin}-{t.diasMax} días</span>
                      )}
                    </span>
                    <span className="font-bold text-titular tabular-nums">{formatoPrecio(t.precioCents)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="mt-5 rounded-boton border border-magenta/40 bg-magenta/5 px-4 py-3 text-[14px] text-magenta">
            {error}
          </p>
        )}
      </div>

      <aside className="rounded-tarjeta border border-linea bg-panel p-6">
        <h2 className="text-[15px] font-extrabold text-titular">Tu pedido</h2>

        <ul className="mt-3 divide-y divide-linea">
          {datos.lineas.map((l) => (
            <li key={l.variante.id} className="flex gap-3 py-3">
              <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-boton bg-fondo">
                {l.variante.imagen && (
                  <Image src={l.variante.imagen} alt="" fill sizes="60px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold text-titular">{l.productoNombre}</p>
                {l.variante.nombre !== l.productoNombre && (
                  <p className="truncate text-[12.5px] text-gris">{l.variante.nombre}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-full border border-linea px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => cambiarCantidad(l.variante.id, l.cantidad - 1)}
                      aria-label={`Quitar una unidad de ${l.productoNombre}`}
                      className="px-1 text-[15px] leading-none text-gris hover:text-titular"
                    >
                      −
                    </button>
                    <span className="min-w-[16px] text-center text-[12.5px] font-bold tabular-nums">{l.cantidad}</span>
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
              <span className="shrink-0 text-[14.5px] font-bold text-titular tabular-nums">
                {formatoPrecio(l.totalLineaCents)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 border-t border-linea pt-4 text-[14px]">
          <div className="flex justify-between">
            <span className="text-cuerpo">Subtotal</span>
            <span className="font-bold text-titular tabular-nums">{formatoPrecio(datos.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cuerpo">Envío</span>
            <span className={envio ? 'font-bold text-titular tabular-nums' : 'text-gris'}>
              {envio ? formatoPrecio(envio.precioCents) : 'por calcular'}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-linea pt-3">
          <span className="text-[15px] font-bold text-cuerpo">Total</span>
          <span className="text-[20px] font-extrabold text-titular tabular-nums">{formatoPrecio(total)}</span>
        </div>

        <button
          type="button"
          onClick={pagar}
          disabled={!tarifaId || pagando || datos.noDisponibles.length > 0}
          className="mt-5 w-full rounded-boton bg-accion px-6 py-3.5 text-[15px] font-bold text-white shadow-boton transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-50"
        >
          {pagando ? 'Abriendo el pago…' : 'Ir a pagar'}
        </button>
        {datos.noDisponibles.length > 0 ? (
          <p className="mt-2 text-center text-[12.5px] text-magenta">Quita antes lo que ya no está disponible.</p>
        ) : (
          !tarifaId && <p className="mt-2 text-center text-[12.5px] text-gris">Calcula el envío para poder pagar.</p>
        )}

        <p className="mt-4 text-[12px] leading-[1.5] text-gris">
          El pago se hace en la página segura de Stripe. No pasamos por aquí ningún dato de tu tarjeta.
        </p>

        <Link
          href="/tienda"
          className="mt-4 inline-block text-[13.5px] font-bold text-gris no-underline hover:text-titular"
        >
          ← Seguir mirando
        </Link>
      </aside>
    </div>
  );
}
