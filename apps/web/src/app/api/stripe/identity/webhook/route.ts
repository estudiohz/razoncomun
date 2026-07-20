import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Webhook de Stripe Identity. Reglas (I7, revision-seguridad.md):
 * 1. Firma verificada SIEMPRE (Stripe-Signature) antes de mirar el body.
 * 2. Idempotencia: Stripe puede reenviar el mismo evento — se comprueba en
 *    `audit_log` (meta->>'stripe_event_id'; no se usa `entity_id` porque es
 *    `uuid` y los IDs de evento de Stripe no lo son) antes de aplicar nada.
 * 3. Solo se guarda el VEREDICTO (verified/requires_input/canceled) + IDs.
 *    Jamás el documento ni el selfie — Stripe los custodia y los borra según
 *    su propia retención; nosotros no los tocamos en ningún momento.
 * 4. La escritura en `profiles.level` la hace `service_role` (único rol que
 *    el trigger `profiles_protect_level_trg` permite).
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe Identity no configurado' }, { status: 501 });
  }

  const stripe = new Stripe(secretKey);
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature ?? '', webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Firma inválida: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Idempotencia: ¿ya procesamos este evento?
  const { data: yaProcesado } = await admin
    .from('audit_log')
    .select('id')
    .eq('entity', 'stripe_identity_event')
    .eq('meta->>stripe_event_id', event.id)
    .maybeSingle();

  if (yaProcesado) {
    return NextResponse.json({ ok: true, idempotente: true });
  }

  if (event.type === 'identity.verification_session.verified') {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const userId = session.metadata?.user_id;

    if (userId) {
      await admin
        .from('profiles')
        .update({ identity_verified_at: new Date().toISOString(), level: 'verified' })
        .eq('id', userId);
    }

    await admin.from('audit_log').insert({
      actor_id: null,
      action: 'stripe_identity_verified',
      entity: 'stripe_identity_event',
      entity_id: null,
      meta: { stripe_event_id: event.id, session_id: session.id, user_id: userId ?? null },
    });
  } else if (
    event.type === 'identity.verification_session.requires_input' ||
    event.type === 'identity.verification_session.canceled'
  ) {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    await admin.from('audit_log').insert({
      actor_id: null,
      action: `stripe_identity_${event.type.split('.').pop()}`,
      entity: 'stripe_identity_event',
      entity_id: null,
      meta: {
        stripe_event_id: event.id,
        session_id: session.id,
        user_id: session.metadata?.user_id ?? null,
        last_error: session.last_error?.reason ?? null,
      },
    });
  } else {
    // Tipo de evento no relevante para nosotros: se ignora sin error (Stripe
    // espera 200 igualmente para no reintentar indefinidamente).
    await admin.from('audit_log').insert({
      actor_id: null,
      action: 'stripe_identity_evento_ignorado',
      entity: 'stripe_identity_event',
      entity_id: null,
      meta: { stripe_event_id: event.id, tipo: event.type },
    });
  }

  return NextResponse.json({ ok: true });
}
