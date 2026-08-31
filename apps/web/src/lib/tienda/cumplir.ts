import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolverCarritoAction } from '@/app/tienda/actions';
import { crearPedido, confirmarPedido } from './printful';
import { META_ENVIO, META_LINEAS, decodificarLineas, verificarImporte } from './pedido';

/**
 * Cumplimiento de un pedido de la tienda: de "Stripe dice que se ha pagado" a
 * "Printful lo está imprimiendo".
 *
 * ⚠️ AQUÍ SE GASTA DINERO REAL. Cada pedido que sale de esta función se
 * imprime y se envía. Las tres reglas que lo sostienen:
 *
 *  1. IDEMPOTENCIA DURA. `shop_orders.stripe_session_id` es UNIQUE (0047). Si
 *     Stripe reentrega el evento — lo hace, es normal — el segundo INSERT
 *     falla y se sale sin fabricar nada. No basta con el registro de
 *     `event.id`: dos eventos DISTINTOS pueden referirse a la misma sesión.
 *  2. EL IMPORTE SE VERIFICA. Se recalcula el pedido contra Printful y se
 *     compara con lo que Stripe cobró. Si no cuadra exactamente, no se
 *     fabrica: se guarda como `failed` con el motivo.
 *  3. EL PEDIDO SE CREA COMO BORRADOR Y LUEGO SE CONFIRMA. Si algo revienta
 *     entre medias queda un borrador en Printful que no se produce, en vez de
 *     un envío fantasma.
 */

export interface ResultadoCumplimiento {
  estado: 'creado' | 'duplicado' | 'fallido';
  detalle?: string;
  printfulOrderId?: number;
}

function direccionDe(sesion: Stripe.Checkout.Session): {
  nombre: string;
  direccion1: string;
  ciudad: string;
  codigoPostal: string;
  paisCodigo: string;
} | null {
  // La dirección se fijó en `payment_intent_data.shipping` al crear la
  // sesión; llega expandida en `payment_intent`. `collected_information`
  // es el sitio nuevo donde Stripe la publica en algunas versiones de API:
  // se miran los dos antes de rendirse.
  const pi = sesion.payment_intent;
  const envioPI =
    pi && typeof pi !== 'string' ? ((pi as unknown as { shipping?: Stripe.Charge.Shipping }).shipping ?? null) : null;
  const envioSesion =
    (sesion as unknown as { collected_information?: { shipping_details?: Stripe.Charge.Shipping } })
      .collected_information?.shipping_details ?? null;

  const envio = envioPI ?? envioSesion;
  const dir = envio?.address;
  if (!envio?.name || !dir?.line1 || !dir?.city || !dir?.postal_code || !dir?.country) return null;

  return {
    nombre: envio.name,
    direccion1: [dir.line1, dir.line2].filter(Boolean).join(', '),
    ciudad: dir.city,
    codigoPostal: dir.postal_code,
    paisCodigo: dir.country,
  };
}

export async function cumplirPedidoTienda(
  admin: SupabaseClient,
  sesion: Stripe.Checkout.Session,
): Promise<ResultadoCumplimiento> {
  const sessionId = sesion.id;
  const email = sesion.customer_details?.email ?? sesion.customer_email ?? '';
  const envioCents = Number.parseInt(String(sesion.metadata?.[META_ENVIO] ?? '0'), 10) || 0;
  const lineasMeta = decodificarLineas(sesion.metadata?.[META_LINEAS]);

  // --- 1. Reserva idempotente. Se inserta ANTES de tocar Printful: si dos
  // entregas del mismo pago corren a la vez, solo una pasa de aquí.
  const { error: errReserva } = await admin.from('shop_orders').insert({
    stripe_session_id: sessionId,
    email: email || 'desconocido@razoncomun.com',
    total_cents: sesion.amount_total ?? 0,
    shipping_cents: envioCents,
    currency: (sesion.currency ?? 'eur').toUpperCase(),
    status: 'paid',
  });
  if (errReserva) {
    const duplicado =
      errReserva.code === '23505' || /duplicate|unique/i.test(errReserva.message ?? '');
    if (duplicado) return { estado: 'duplicado' };
    return { estado: 'fallido', detalle: `No se pudo registrar el pedido: ${errReserva.message}` };
  }

  const marcarFallido = async (motivo: string): Promise<ResultadoCumplimiento> => {
    await admin
      .from('shop_orders')
      .update({ status: 'failed', printful_error: motivo.slice(0, 1000) })
      .eq('stripe_session_id', sessionId);
    return { estado: 'fallido', detalle: motivo };
  };

  if (lineasMeta.length === 0) {
    return marcarFallido('La sesión de Stripe no traía líneas de pedido en la metadata.');
  }

  const destinatario = direccionDe(sesion);
  if (!destinatario) {
    return marcarFallido('La sesión de Stripe no traía dirección de envío completa.');
  }

  // --- 2. Reconstruir el pedido contra Printful y verificar el importe.
  const carrito = await resolverCarritoAction(
    lineasMeta.map((l) => ({ variantId: l.variantId, cantidad: l.cantidad })),
  );
  if (carrito.lineas.length !== lineasMeta.length) {
    return marcarFallido(
      'Alguna variante del pedido ya no existe o no está disponible en Printful; no se fabrica nada.',
    );
  }

  const verificacion = verificarImporte({
    subtotalCents: carrito.subtotalCents,
    envioCents,
    cobradoCents: sesion.amount_total,
  });
  if (!verificacion.ok) {
    return marcarFallido(
      `${verificacion.motivo} (esperado ${verificacion.esperadoCents}, cobrado ${verificacion.cobradoCents}).`,
    );
  }

  // --- 3. Borrador en Printful y confirmación.
  let printfulOrderId: number;
  try {
    const pedido = await crearPedido({
      externalId: sessionId,
      destinatario: { ...destinatario, email: email || 'pedidos@razoncomun.com' },
      lineas: carrito.lineas.map((l) => ({ variante: l.variante, cantidad: l.cantidad })),
    });
    printfulOrderId = pedido.id;
  } catch (err) {
    return marcarFallido(`Printful rechazó el pedido: ${err instanceof Error ? err.message : 'error desconocido'}`);
  }

  await admin
    .from('shop_orders')
    .update({ status: 'sent_to_printful', printful_order_id: printfulOrderId })
    .eq('stripe_session_id', sessionId);

  try {
    await confirmarPedido(printfulOrderId);
  } catch (err) {
    // El borrador SÍ existe: no se pierde el pedido, queda pendiente de
    // confirmar a mano en Printful con su id ya guardado.
    return marcarFallido(
      `Pedido ${printfulOrderId} creado pero NO confirmado: ${err instanceof Error ? err.message : 'error'}. ` +
        'Confírmalo a mano en Printful.',
    );
  }

  await admin
    .from('shop_orders')
    .update({ status: 'confirmed' })
    .eq('stripe_session_id', sessionId);

  return { estado: 'creado', printfulOrderId };
}
