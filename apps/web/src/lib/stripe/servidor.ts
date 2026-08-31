import 'server-only';
import Stripe from 'stripe';
import { credencialActiva } from '@/lib/pagos/credenciales';

/**
 * Acceso a Stripe con credenciales — SOLO SERVIDOR.
 *
 * ⚠️ Vive aparte de `config.ts` a propósito. `config.ts` exporta cosas que un
 * Client Component necesita de verdad (`CUOTA_REFERENCIA_CENTS`, los tipos de
 * plan: los usa `unete/AltaSepa.tsx`), así que NO puede llevar `server-only`.
 * Todo lo que toca la clave secreta va aquí. Meterlo en config.ts rompió el
 * build de dev el 31/08/2026 con "server-only cannot be imported from a
 * Client Component".
 *
 * DE DÓNDE SALE LA CLAVE (migración 0053): primero la credencial activa de
 * `payment_provider_credentials`, que se pega desde /admin/tienda/pagos; si no
 * hay ninguna, la variable de entorno de siempre. Ese orden importa: mientras
 * nadie guarde nada en el panel, el comportamiento es EXACTAMENTE el de antes,
 * así que esto no puede tumbar por sí solo la afiliación ni el webhook.
 */

/** Clave secreta: BD primero, entorno de reserva. */
export async function stripeSecretKey(): Promise<string> {
  const guardada = await credencialActiva('stripe').catch(() => null);
  if (guardada?.secret) return guardada.secret;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'No hay clave de Stripe: ni credencial guardada en /admin/tienda/pagos ni STRIPE_SECRET_KEY ' +
        'en el entorno. Ver apps/web/AFILIACION-SETUP.md.',
    );
  }
  return key;
}

export async function stripeWebhookSecret(): Promise<string> {
  const guardada = await credencialActiva('stripe').catch(() => null);
  if (guardada?.webhook_secret) return guardada.webhook_secret;

  const key = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) {
    throw new Error(
      'No hay secreto de webhook de Stripe: ni guardado en /admin/tienda/pagos ni ' +
        'STRIPE_WEBHOOK_SECRET en el entorno. Ver apps/web/AFILIACION-SETUP.md.',
    );
  }
  return key;
}

let cliente: Stripe | null = null;
let claveDelCliente: string | null = null;

/**
 * Cliente Stripe compartido.
 *
 * Se cachea por CLAVE, no a secas: si alguien cambia la credencial en el panel
 * (o pasa de test a live), un cliente memoizado con la clave vieja seguiría
 * cobrando en la cuenta equivocada hasta el siguiente despliegue.
 */
export async function stripeCliente(): Promise<Stripe> {
  if (typeof window !== 'undefined') {
    throw new Error('stripeCliente() es solo de servidor.');
  }
  const clave = await stripeSecretKey();
  if (!cliente || claveDelCliente !== clave) {
    cliente = new Stripe(clave);
    claveDelCliente = clave;
  }
  return cliente;
}
