import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Idempotencia de webhooks de Stripe (I7, revision-seguridad.md), MISMO
 * patrón que ya usa rc-03 para el webhook de Stripe Identity
 * (`/api/stripe/identity/webhook`): se registra cada `event.id` procesado en
 * `audit_log` (append-only, ver 0013_audit.sql) y se comprueba antes de
 * aplicar ningún efecto. `entity` distingue el dominio de evento:
 * `stripe_subscription_event` aquí, `stripe_identity_event` en rc-03 — así
 * ambos webhooks conviven en la misma tabla sin colisionar.
 */
const ENTIDAD = 'stripe_subscription_event';

export async function yaProcesado(admin: SupabaseClient, eventId: string): Promise<boolean> {
  const { data } = await admin
    .from('audit_log')
    .select('id')
    .eq('entity', ENTIDAD)
    .eq('meta->>stripe_event_id', eventId)
    .maybeSingle();
  return Boolean(data);
}

export async function registrarEvento(
  admin: SupabaseClient,
  opts: {
    eventId: string;
    tipo: string;
    action: string;
    userId?: string | null;
    entityId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  await admin.from('audit_log').insert({
    actor_id: null,
    action: opts.action,
    entity: ENTIDAD,
    entity_id: opts.entityId ?? null,
    meta: {
      stripe_event_id: opts.eventId,
      stripe_event_type: opts.tipo,
      user_id: opts.userId ?? null,
      ...opts.meta,
    },
  });
}
