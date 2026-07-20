/**
 * Configuración centralizada de Stripe para afiliación/transparencia (rc-07).
 *
 * DECISIÓN (docs/tecnico/afiliados-y-transparencia.md, cabecera): la cuota se
 * cobra por domiciliación SEPA (`sepa_debit`), no con tarjeta. Este archivo
 * es el único sitio que decide qué `payment_method_types` se ofrecen en
 * Checkout — así queda documentado el único punto donde alguien podría
 * "colar" tarjeta por error.
 *
 * ⚠️ Bloqueo conocido en la cuenta de Stripe (verificado 20/07/2026): la
 * capability `sepa_debit` está deshabilitada (Settings → Payment methods).
 * El código de producción pide SIEMPRE `sepa_debit`; Stripe devolverá un
 * error de Checkout hasta que Sergio la active. `RC_STRIPE_TEST_PAYMENT_METHODS`
 * es una vía de escape SOLO para pruebas locales (nunca se define en
 * Dokploy/producción) que permite forzar `card` mientras se prueba el resto
 * del pipeline (webhooks, idempotencia, member sync) sin depender del ok de
 * Sergio en el dashboard.
 */
import Stripe from 'stripe';

export function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Falta STRIPE_SECRET_KEY. Ver apps/web/AFILIACION-SETUP.md.');
  }
  return key;
}

export function stripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) {
    throw new Error('Falta STRIPE_WEBHOOK_SECRET. Ver apps/web/AFILIACION-SETUP.md.');
  }
  return key;
}

let cliente: Stripe | null = null;

/** Cliente Stripe compartido (server-side SOLO — nunca importar desde 'use client'). */
export function stripeCliente(): Stripe {
  if (typeof window !== 'undefined') {
    throw new Error('stripeCliente() es solo de servidor.');
  }
  if (!cliente) {
    cliente = new Stripe(stripeSecretKey());
  }
  return cliente;
}

export type Periodicidad = 'monthly' | 'annual';

/**
 * Precios de la cuota. Los IDs de Price los crea Sergio en el dashboard de
 * Stripe (test o live) — ver AFILIACION-SETUP.md — y se configuran por env
 * var para no tocar código si cambian los importes. En ausencia de las
 * variables (entorno de desarrollo temprano) se usan los Price de TEST
 * creados por este mismo agente para poder construir y probar el flujo
 * completo (ver AFILIACION-SETUP.md, tabla de IDs de prueba).
 */
export function priceIdCuota(periodo: Periodicidad): string {
  const envVar = periodo === 'monthly' ? 'STRIPE_PRICE_CUOTA_MENSUAL' : 'STRIPE_PRICE_CUOTA_ANUAL';
  const valor = process.env[envVar];
  if (!valor) {
    throw new Error(`Falta ${envVar}. Ver apps/web/AFILIACION-SETUP.md.`);
  }
  return valor;
}

/** Importes de referencia (solo para pintar la UI; el cobro real lo decide el Price de Stripe). */
export const CUOTA_REFERENCIA_CENTS: Record<Periodicidad, number> = {
  monthly: 500, // 5,00 €/mes
  annual: 5000, // 50,00 €/año (2 meses "gratis" frente a 12×5€, ventaja SEPA de la doc)
};

/**
 * Métodos de pago ofrecidos en Checkout. SIEMPRE `['sepa_debit']` salvo que
 * `RC_STRIPE_TEST_PAYMENT_METHODS` esté definida (solo en `.env.local` de
 * desarrollo, nunca en Dokploy) — vía de escape documentada arriba.
 */
export function metodosPagoCheckout(): Stripe.Checkout.SessionCreateParams.PaymentMethodType[] {
  const override = process.env.RC_STRIPE_TEST_PAYMENT_METHODS;
  if (override) {
    return override.split(',').map((m) => m.trim()) as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
  }
  return ['sepa_debit'];
}
