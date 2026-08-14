'use server';

import { requireUsuario } from '@/lib/auth/niveles';
import { registrarAuditoria } from '@/lib/admin/audit';
import {
  stripeCliente,
  priceIdCuota,
  planVerificadoDisponible,
  type Periodicidad,
  type PlanCuota,
} from '@/lib/stripe/config';
import { TEXTO_CONSENTIMIENTO_AFILIACION } from '@/lib/afiliacion/consentimiento';
import { TEXTO_CONSENTIMIENTO } from '@/lib/auth/consentimiento';
import { validarNIF, normalizarNIF } from '@/lib/afiliacion/nif';

/**
 * Alta de afiliado NATIVA (rc-07, encargo del orquestador): sin salir de la
 * web (a diferencia del Checkout hospedado que sustituye esta versión).
 * Reusa la base de la Ola 3 — mismo `stripeCliente()`/`priceIdCuota()` de
 * `lib/stripe/config.ts`, mismo webhook (`/api/stripe/webhook`) y misma
 * idempotencia (`lib/stripe/eventos.ts`) — solo cambia CÓMO se recoge el
 * IBAN: Customer + SetupIntent confirmado con Stripe Elements en el propio
 * cliente (`AltaSepa.tsx`) en vez de redirigir a stripe.com.
 *
 * Dos pasos, en el orden legal exigido por el encargo:
 *
 * 1. `iniciarDomiciliacion` — NIF (validado con dígito de control, no solo
 *    formato) → `tax_identities`; consentimiento Art. 9.2.a (voto público y
 *    nominal, D-001, texto reutilizado literalmente de
 *    `lib/auth/consentimiento.ts`) + aviso de domiciliación → `audit_log`
 *    con timestamp. Solo DESPUÉS se crea el Customer + SetupIntent de
 *    Stripe. Si el usuario abandona aquí, el NIF y el consentimiento ya
 *    quedan guardados (hechos consumados, igual que en el Checkout previo).
 * 2. `confirmarAfiliacion` — una vez el cliente confirma el SetupIntent con
 *    su IBAN (mandato SEPA aceptado vía Stripe.js, que registra
 *    automáticamente IP/user-agent de aceptación online), se fija el método
 *    de pago por defecto y se crea la Subscription. El webhook existente
 *    hace el resto (espejo en `members`, subida de nivel, email de
 *    bienvenida) — este archivo NUNCA escribe en `members` directamente.
 */

export type ResultadoInicio =
  | { ok: false; mensaje: string }
  | { ok: true; clientSecret: string; customerId: string };

/**
 * Valida el plan que llega del cliente. Se comprueba en SERVIDOR y no solo en
 * el formulario: `plan` decide qué Price se cobra, así que nunca se puede
 * confiar en lo que mande el navegador. Si el tramo verificado no está
 * configurado en este entorno se rechaza en vez de caer más adelante con un
 * "Falta STRIPE_PRICE_VERIFICADO_MENSUAL" cuando ya se ha firmado el mandato.
 */
function validarPlan(plan: unknown): PlanCuota | null {
  if (plan !== 'socio' && plan !== 'verificado') return null;
  if (plan === 'verificado' && !planVerificadoDisponible()) return null;
  return plan;
}

export async function iniciarDomiciliacion(input: {
  plan: PlanCuota;
  periodo: Periodicidad;
  nif: string;
  consentimiento: boolean;
}): Promise<ResultadoInicio> {
  const { user, supabase } = await requireUsuario('/unete');

  const plan = validarPlan(input.plan);
  if (!plan) {
    return { ok: false, mensaje: 'Ese plan de cuota no está disponible. Elige uno de la lista.' };
  }

  if (input.periodo !== 'monthly' && input.periodo !== 'annual') {
    return { ok: false, mensaje: 'Elige una periodicidad de cuota antes de continuar.' };
  }

  const nif = normalizarNIF(input.nif);
  if (!validarNIF(nif)) {
    return {
      ok: false,
      mensaje: 'Ese NIF/NIE no es válido: la letra no coincide con el dígito de control esperado.',
    };
  }

  if (!input.consentimiento) {
    return { ok: false, mensaje: 'Debes marcar la casilla de consentimiento para continuar.' };
  }

  // 1. NIF → tax_identities (D-020). RLS: alta/actualización propia
  // (tax_identities_insert_own / _update_own, 0022_tax_identities.sql).
  // verified_method se queda en su default 'declared' — la verificación por
  // documento (Stripe Identity) es un paso aparte y posterior (solo para
  // voto vinculante, D-017), no se toca aquí.
  const { error: errorNif } = await supabase
    .from('tax_identities')
    .upsert({ user_id: user.id, tax_id: nif }, { onConflict: 'user_id' });

  if (errorNif) {
    return { ok: false, mensaje: `No se pudo guardar el NIF: ${errorNif.message}` };
  }

  // 2. Consentimiento — Art. 9.2.a (D-001: el voto interno, si algún día es
  // vinculante, es público y nominal) + el aviso previo de domiciliación
  // SEPA. Se reutiliza literalmente TEXTO_CONSENTIMIENTO de rc-03 (mismo
  // texto que ya se muestra en /registro/consentimiento) para que quede
  // sellado también en el momento exacto en que la persona pasa a ser
  // afiliada de cuota — el hecho que activa de verdad el tratamiento de
  // categoría especial y la aparición en el censo de votaciones.
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'affiliation_consent_given',
    entity: 'affiliation_consent',
    entityId: user.id,
    meta: {
      plan,
      periodo: input.periodo,
      texto_voto_publico_nominal_d001: TEXTO_CONSENTIMIENTO,
      texto_domiciliacion_sepa: TEXTO_CONSENTIMIENTO_AFILIACION,
      given_at: new Date().toISOString(),
    },
  });

  const stripe = stripeCliente();

  // 3. Customer de Stripe. Se reutiliza el de un intento anterior si existe
  // (lectura de `members`, permitida por RLS propia — nunca se escribe aquí:
  // members_select_own_or_finance, 0003_identity.sql). Si el usuario nunca
  // llegó a crear una Subscription, no habrá fila en `members` todavía (la
  // crea el webhook) y se crea un Customer nuevo — límite conocido: un
  // abandono repetido en este paso puede dejar Customers huérfanos en
  // Stripe (sin coste, sin efecto funcional; ver informe).
  const { data: miembroExistente } = await supabase
    .from('members')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let customerId = miembroExistente?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  // 4. SetupIntent — captura el IBAN y el mandato SEPA in situ (Stripe
  // Elements en `AltaSepa.tsx`), sin redirigir a stripe.com.
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['sepa_debit'],
    metadata: { user_id: user.id, plan, periodo: input.periodo },
  });

  if (!setupIntent.client_secret) {
    return { ok: false, mensaje: 'Stripe no devolvió el secreto de configuración del mandato.' };
  }

  return { ok: true, clientSecret: setupIntent.client_secret, customerId };
}

export type ResultadoConfirmacion = { ok: true } | { ok: false; mensaje: string };

export async function confirmarAfiliacion(input: {
  plan: PlanCuota;
  periodo: Periodicidad;
  customerId: string;
  paymentMethodId: string;
}): Promise<ResultadoConfirmacion> {
  const { user } = await requireUsuario('/unete');
  const stripe = stripeCliente();

  // Se revalida aquí y no solo en `iniciarDomiciliacion`: son dos llamadas
  // independientes desde el cliente, y esta es la que de verdad crea la
  // Subscription (la que cobra).
  const plan = validarPlan(input.plan);
  if (!plan) {
    return { ok: false, mensaje: 'Ese plan de cuota no está disponible. Vuelve atrás y elige uno.' };
  }
  if (input.periodo !== 'monthly' && input.periodo !== 'annual') {
    return { ok: false, mensaje: 'Elige una periodicidad de cuota antes de continuar.' };
  }

  try {
    await stripe.customers.update(input.customerId, {
      invoice_settings: { default_payment_method: input.paymentMethodId },
    });

    await stripe.subscriptions.create({
      customer: input.customerId,
      items: [{ price: priceIdCuota(plan, input.periodo) }],
      default_payment_method: input.paymentMethodId,
      collection_method: 'charge_automatically',
      // `plan` en el metadata para poder auditar desde Stripe qué tramo
      // eligió cada quien. `members.amount_cents` ya lo refleja (el webhook lo
      // lee del Price real), pero el metadata lo deja explícito.
      metadata: { user_id: user.id, plan },
    });
  } catch (err) {
    return { ok: false, mensaje: (err as Error).message };
  }

  return { ok: true };
}
