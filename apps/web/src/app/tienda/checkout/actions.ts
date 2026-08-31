'use server';

import { urlSitio } from '@/lib/supabase/env';
import { stripeCliente } from '@/lib/stripe/servidor';
import {
  META_ENVIO,
  META_LINEAS,
  META_ORIGEN,
  META_TIPO,
  TIPO_TIENDA,
  codificarLineas,
  hostDe,
} from '@/lib/tienda/pedido';
import { calcularEnvio } from '@/lib/tienda/printful';
import type { DestinoEnvio, ItemCarrito, TarifaEnvio } from '@/lib/tienda/tipos';
import { resolverCarritoAction } from '../actions';

/**
 * Checkout de la tienda (ola T2).
 *
 * El reparto de responsabilidades no es negociable (D-T3): del navegador solo
 * salen ids de variante, cantidades y la dirección. TODOS los importes —
 * producto y portes — se calculan aquí, contra Printful, en cada llamada. Un
 * `localStorage` manipulado no puede abaratar una compra porque el precio del
 * navegador no se lee nunca.
 */

/** España, único destino en v1 (D-T5). */
const PAIS = 'ES';
const CP_ES = /^\d{5}$/;

export interface ResultadoEnvio {
  ok: boolean;
  error?: string;
  tarifas?: TarifaEnvio[];
  subtotalCents?: number;
}

function limpiar(v: unknown): string {
  return String(v ?? '').trim();
}

function validarDestino(destino: Partial<DestinoEnvio>): string | null {
  if (!CP_ES.test(limpiar(destino.codigoPostal))) return 'El código postal debe tener 5 dígitos.';
  if (limpiar(destino.ciudad).length < 2) return 'Escribe la ciudad.';
  return null;
}

/**
 * Portes REALES de Printful para el destino. No hay tabla de tarifas nuestra:
 * lo que cueste enviarlo lo dice quien lo envía.
 */
export async function calcularEnvioAction(
  items: ItemCarrito[],
  destino: DestinoEnvio,
): Promise<ResultadoEnvio> {
  const problema = validarDestino(destino);
  if (problema) return { ok: false, error: problema };

  const carrito = await resolverCarritoAction(items);
  if (carrito.lineas.length === 0) {
    return { ok: false, error: 'No hay nada que enviar: tu carrito está vacío.' };
  }

  try {
    const tarifas = await calcularEnvio(
      carrito.lineas.map((l) => ({ variante: l.variante, cantidad: l.cantidad })),
      {
        paisCodigo: PAIS,
        ciudad: limpiar(destino.ciudad),
        codigoPostal: limpiar(destino.codigoPostal),
      },
    );
    if (tarifas.length === 0) {
      return { ok: false, error: 'Printful no ofrece envío a esa dirección. Revisa el código postal.' };
    }
    return { ok: true, tarifas, subtotalCents: carrito.subtotalCents };
  } catch (err) {
    // El mensaje crudo de Printful puede ser críptico ("Invalid variant ID");
    // se registra para nosotros y al comprador se le dice algo accionable.
    console.error('[tienda] fallo calculando portes', err);
    return { ok: false, error: 'No hemos podido calcular el envío ahora mismo. Inténtalo en un momento.' };
  }
}

export interface DatosComprador {
  nombre: string;
  email: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
}

export interface ResultadoPago {
  ok: boolean;
  error?: string;
  url?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Crea la sesión de Stripe Checkout y devuelve su URL.
 *
 * Decisiones que importan:
 *  - Los portes se vuelven a pedir a Printful AQUÍ, no se aceptan del cliente:
 *    si no, bastaría con mandar `envioCents: 0`.
 *  - La dirección viaja en `payment_intent_data.shipping`, no en la metadata.
 *    Así el webhook la lee de Stripe y no duplicamos datos personales en una
 *    metadata que además tiene 500 caracteres de tope (D-T8).
 *  - En la metadata solo van ids, cantidades y los portes cobrados: lo mínimo
 *    para que el webhook pueda RECALCULAR y comparar.
 */
export async function crearSesionPagoAction(
  items: ItemCarrito[],
  comprador: DatosComprador,
  tarifaId: string,
): Promise<ResultadoPago> {
  const nombre = limpiar(comprador.nombre);
  const email = limpiar(comprador.email);
  const direccion = limpiar(comprador.direccion);
  const ciudad = limpiar(comprador.ciudad);
  const codigoPostal = limpiar(comprador.codigoPostal);

  if (nombre.length < 3) return { ok: false, error: 'Escribe tu nombre y apellidos.' };
  if (!EMAIL.test(email)) return { ok: false, error: 'Revisa el correo electrónico.' };
  if (direccion.length < 5) return { ok: false, error: 'Escribe la dirección completa.' };
  const problema = validarDestino({ ciudad, codigoPostal });
  if (problema) return { ok: false, error: problema };

  const carrito = await resolverCarritoAction(items);
  if (carrito.lineas.length === 0) return { ok: false, error: 'Tu carrito está vacío.' };
  if (carrito.noDisponibles.length > 0) {
    return { ok: false, error: 'Algún producto de tu carrito ya no está disponible. Revísalo antes de pagar.' };
  }

  // Portes: se recalculan contra Printful y se busca la tarifa elegida. Si el
  // id no está entre las vigentes, se rechaza en vez de coger la primera.
  let tarifa;
  try {
    const tarifas = await calcularEnvio(
      carrito.lineas.map((l) => ({ variante: l.variante, cantidad: l.cantidad })),
      { paisCodigo: PAIS, ciudad, codigoPostal },
    );
    tarifa = tarifas.find((t) => t.id === tarifaId);
  } catch (err) {
    console.error('[tienda] fallo recalculando portes al pagar', err);
    return { ok: false, error: 'No hemos podido confirmar el envío. Vuelve a calcularlo.' };
  }
  if (!tarifa) {
    return { ok: false, error: 'La opción de envío ya no es válida. Vuelve a calcular el envío.' };
  }

  const base = urlSitio().replace(/\/$/, '');
  const stripe = await stripeCliente();

  try {
    const sesion = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      locale: 'es',
      line_items: carrito.lineas.map((l) => ({
        quantity: l.cantidad,
        price_data: {
          currency: 'eur',
          unit_amount: l.variante.precioCents,
          product_data: {
            name: l.productoNombre,
            description: l.variante.nombre !== l.productoNombre ? l.variante.nombre : undefined,
            images: l.variante.imagen ? [l.variante.imagen] : undefined,
          },
        },
      })),
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: tarifa.nombre || 'Envío',
            fixed_amount: { amount: tarifa.precioCents, currency: 'eur' },
          },
        },
      ],
      payment_intent_data: {
        shipping: {
          name: nombre,
          address: { line1: direccion, city: ciudad, postal_code: codigoPostal, country: PAIS },
        },
      },
      metadata: {
        [META_TIPO]: TIPO_TIENDA,
        [META_LINEAS]: codificarLineas(
          carrito.lineas.map((l) => ({ variantId: l.variante.id, cantidad: l.cantidad })),
        ),
        [META_ENVIO]: String(tarifa.precioCents),
        // Qué entorno creó esta sesión: el webhook del OTRO la ignorará.
        [META_ORIGEN]: hostDe(base),
      },
      success_url: `${base}/tienda/gracias?sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/tienda/checkout`,
    });

    if (!sesion.url) return { ok: false, error: 'Stripe no ha devuelto una página de pago.' };
    return { ok: true, url: sesion.url };
  } catch (err) {
    console.error('[tienda] fallo creando la sesión de pago', err);
    return {
      ok: false,
      error: `No se ha podido abrir el pago: ${err instanceof Error ? err.message : 'error desconocido'}`,
    };
  }
}
