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
// `import type`: solo se usan tipos del SDK aquí. Con un import normal, el SDK
// de servidor entraría en el bundle de cualquier Client Component que importe
// este fichero (unete/AltaSepa.tsx lo hace para leer CUOTA_REFERENCIA_CENTS).
import type Stripe from 'stripe';

/**
 * ⚠️ LA CLAVE SECRETA NO ESTÁ AQUÍ. `stripeCliente()`, `stripeSecretKey()` y
 * `stripeWebhookSecret()` viven en `lib/stripe/servidor.ts`, que es
 * `server-only`. Este fichero NO puede serlo: lo importa un Client Component.
 */

export type Periodicidad = 'monthly' | 'annual';

/**
 * Plan de cuota (Sergio, 10/08/2026). Dos tramos, no uno:
 *
 * - `socio`       — 5 €/mes · 50 €/año. La cuota de siempre.
 * - `verificado`  — 6 €/mes · 60 €/año. Un euro más al mes que costea la
 *   verificación de identidad (Stripe Identity, ~1,50 € por verificación) y
 *   el sobrecoste de mantener el censo verificado.
 *
 * ⚠️ **Pagar el plan `verificado` NO sube el nivel a `verified`.** El nivel lo
 * concede exclusivamente el webhook de Stripe Identity cuando la persona
 * completa la verificación desde su perfil (D-017). El plan solo elige cuánto
 * se cobra; quien pague el tramo alto y nunca verifique se queda en `member`.
 * La UI debe decirlo con todas las letras — vender el nivel con la cuota sería
 * cobrar por algo que no se entrega.
 */
export type PlanCuota = 'socio' | 'verificado';

/**
 * Precios de la cuota. Los IDs de Price los crea Sergio en el dashboard de
 * Stripe (test o live) — ver AFILIACION-SETUP.md — y se configuran por env
 * var para no tocar código si cambian los importes.
 *
 * Los dos Price del plan `socio` conservan sus nombres de variable originales
 * (`STRIPE_PRICE_CUOTA_*`) a propósito: ya están puestas en Dokploy y
 * renombrarlas dejaría la afiliación caída en el mismo despliegue en que se
 * subiera este cambio. Los del tramo verificado son variables nuevas.
 */
const ENV_PRICE: Record<PlanCuota, Record<Periodicidad, string>> = {
  socio: {
    monthly: 'STRIPE_PRICE_CUOTA_MENSUAL',
    annual: 'STRIPE_PRICE_CUOTA_ANUAL',
  },
  verificado: {
    monthly: 'STRIPE_PRICE_VERIFICADO_MENSUAL',
    annual: 'STRIPE_PRICE_VERIFICADO_ANUAL',
  },
};

export function priceIdCuota(plan: PlanCuota, periodo: Periodicidad): string {
  const envVar = ENV_PRICE[plan][periodo];
  const valor = process.env[envVar];
  if (!valor) {
    throw new Error(`Falta ${envVar}. Ver apps/web/AFILIACION-SETUP.md.`);
  }
  return valor;
}

/** ¿Están configurados los dos Price del tramo verificado? Si no, la UI no
 *  ofrece ese plan: es preferible enseñar solo el de siempre a enseñar una
 *  opción que reventaría con "Falta STRIPE_PRICE_VERIFICADO_MENSUAL" justo
 *  al confirmar el mandato. */
export function planVerificadoDisponible(): boolean {
  return Boolean(
    process.env.STRIPE_PRICE_VERIFICADO_MENSUAL?.trim() &&
      process.env.STRIPE_PRICE_VERIFICADO_ANUAL?.trim(),
  );
}

/** Importes de referencia (solo para pintar la UI; el cobro real lo decide el Price de Stripe). */
export const CUOTA_REFERENCIA_CENTS: Record<PlanCuota, Record<Periodicidad, number>> = {
  socio: {
    monthly: 500, // 5,00 €/mes
    annual: 5000, // 50,00 €/año (2 meses "gratis" frente a 12×5€, ventaja SEPA de la doc)
  },
  verificado: {
    monthly: 600, // 6,00 €/mes
    annual: 6000, // 60,00 €/año (misma proporción: 2 meses "gratis" frente a 12×6€)
  },
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
