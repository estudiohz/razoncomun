'use server';

import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';
import { registrarAuditoria } from '@/lib/admin/audit';
import { stripeCliente, priceIdCuota, metodosPagoCheckout, type Periodicidad } from '@/lib/stripe/config';
import { TEXTO_CONSENTIMIENTO_AFILIACION } from '@/lib/afiliacion/consentimiento';

/**
 * Alta de afiliado de cuota (rc-07). Server Action de `/afiliate`:
 *
 * 1. Exige sesión (registered como mínimo — cualquier usuario logueado
 *    puede afiliarse; no hace falta ser ya 'member').
 * 2. Exige el checkbox de consentimiento específico marcado (Art. 9 RGPD +
 *    autorización SEPA) — sin esto, no se llega a Stripe.
 * 3. Registra el consentimiento con timestamp en `audit_log` ANTES de
 *    redirigir a Stripe (si el usuario abandona el Checkout, el
 *    consentimiento dado queda igualmente probado — es un hecho ya
 *    ocurrido, independiente de si completa el pago).
 * 4. Crea el Checkout Session en modo suscripción con `sepa_debit` (o el
 *    override de pruebas, ver stripe/config.ts) y `metadata.user_id` en la
 *    propia Subscription (no en la Session) — así el webhook de
 *    customer.subscription.created ya trae el dato sin tener que procesar
 *    checkout.session.completed aparte (ver comentario en el webhook).
 * 5. Redirige al Checkout hospedado por Stripe — el mandato SEPA
 *    reglamentario (referencia, esquema CORE, 8 semanas) lo muestra Stripe
 *    ahí mismo, es su obligación legal como "acreedor" a efectos de cobro.
 */
export async function crearCheckoutSepa(formData: FormData) {
  const { user, supabase } = await requireUsuario('/afiliate');

  const periodo = formData.get('periodo');
  if (periodo !== 'monthly' && periodo !== 'annual') {
    redirect('/afiliate?error=periodo_invalido');
  }
  const periodicidad = periodo as Periodicidad;

  const consentimiento = formData.get('consentimiento');
  if (consentimiento !== 'on') {
    redirect('/afiliate?error=falta_consentimiento');
  }

  // Auditoría del consentimiento — hecho consumado, independiente de si el
  // usuario completa o abandona el Checkout de Stripe a continuación.
  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'affiliation_consent_given',
    entity: 'affiliation_consent',
    entityId: user.id,
    meta: {
      periodo: periodicidad,
      texto: TEXTO_CONSENTIMIENTO_AFILIACION,
      given_at: new Date().toISOString(),
    },
  });

  const stripe = stripeCliente();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.razoncomun.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: metodosPagoCheckout(),
    line_items: [{ price: priceIdCuota(periodicidad), quantity: 1 }],
    customer_email: user.email,
    locale: 'es',
    subscription_data: {
      metadata: { user_id: user.id },
    },
    success_url: `${siteUrl}/perfil?afiliacion=ok`,
    cancel_url: `${siteUrl}/afiliate?afiliacion=cancelado`,
  });

  if (!session.url) {
    redirect('/afiliate?error=stripe_sin_url');
  }

  redirect(session.url);
}
