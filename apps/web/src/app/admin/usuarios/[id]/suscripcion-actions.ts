'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/guard';
import { stripeCliente, stripeSecretKey } from '@/lib/stripe/config';

export interface ResultadoSuscripcion {
  ok: boolean;
  error?: string;
  mensaje?: string;
}

/**
 * Acciones sobre la suscripción de un afiliado, sin salir del panel.
 *
 * Reglas que valen para las tres:
 *  - Solo **admin** (no editor ni tesorero): tocan el cobro de una persona.
 *  - Se opera contra Stripe, que es la fuente de verdad. NO se escribe
 *    `members.status` a mano: el webhook `customer.subscription.updated` llega
 *    a continuación y espeja el estado. Escribir aquí además crearía dos
 *    versiones de la verdad que se desincronizan en cuanto una falle.
 *  - Todo queda en `audit_log`: es dinero de un tercero.
 */
async function conStripe(rutaVuelta: string) {
  const { user, supabase } = await requireAdmin(rutaVuelta);
  await stripeSecretKey(); // lanza si no está configurada
  return { stripe: await stripeCliente(), supabase, actorId: user.id };
}

async function auditar(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  actorId: string,
  accion: string,
  userId: string,
  meta: Record<string, unknown>,
) {
  await supabase.from('audit_log').insert({
    actor_id: actorId,
    action: accion,
    entity: 'members',
    entity_id: null,
    meta: { ...meta, afectado: userId },
  });
}

async function suscripcionDe(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  userId: string,
): Promise<{ id: string; subId: string } | null> {
  const { data } = await supabase
    .from('members')
    .select('id, stripe_subscription_id, status')
    .eq('user_id', userId)
    .not('stripe_subscription_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.stripe_subscription_id) return null;
  return { id: data.id, subId: data.stripe_subscription_id };
}

/**
 * Pausa el cobro. `behavior: 'void'` = las facturas del periodo pausado no se
 * emiten ni se deben: al reanudar no le llega una cuota atrasada acumulada,
 * que es lo que espera alguien que pide "páusame unos meses". Con
 * `keep_as_draft` se le cobraría todo junto al volver.
 */
export async function pausarCuotaAction(userId: string): Promise<ResultadoSuscripcion> {
  try {
    const { stripe, supabase, actorId } = await conStripe(`/admin/usuarios/${userId}`);
    const s = await suscripcionDe(supabase, userId);
    if (!s) return { ok: false, error: 'Esta persona no tiene una suscripción de Stripe asociada.' };

    await stripe.subscriptions.update(s.subId, {
      pause_collection: { behavior: 'void' },
    });

    await auditar(supabase, actorId, 'member_subscription_pause', userId, { subscription_id: s.subId });
    revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/admin/usuarios');
    return { ok: true, mensaje: 'Cuota pausada. Conserva su condición de afiliado.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido pausar la cuota.' };
  }
}

/** Reanuda el cobro (quita pause_collection). */
export async function reanudarCuotaAction(userId: string): Promise<ResultadoSuscripcion> {
  try {
    const { stripe, supabase, actorId } = await conStripe(`/admin/usuarios/${userId}`);
    const s = await suscripcionDe(supabase, userId);
    if (!s) return { ok: false, error: 'Esta persona no tiene una suscripción de Stripe asociada.' };

    await stripe.subscriptions.update(s.subId, { pause_collection: null });

    await auditar(supabase, actorId, 'member_subscription_resume', userId, { subscription_id: s.subId });
    revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/admin/usuarios');
    return { ok: true, mensaje: 'Cuota reanudada.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido reanudar la cuota.' };
  }
}

/**
 * Cancela al final del periodo ya pagado, no al instante: la persona ha pagado
 * hasta esa fecha y cortarle antes sería quedarse con dinero por un servicio
 * que no presta.
 */
export async function cancelarCuotaAction(userId: string): Promise<ResultadoSuscripcion> {
  try {
    const { stripe, supabase, actorId } = await conStripe(`/admin/usuarios/${userId}`);
    const s = await suscripcionDe(supabase, userId);
    if (!s) return { ok: false, error: 'Esta persona no tiene una suscripción de Stripe asociada.' };

    const sub = await stripe.subscriptions.update(s.subId, { cancel_at_period_end: true });

    await auditar(supabase, actorId, 'member_subscription_cancel', userId, {
      subscription_id: s.subId,
      cancel_at: sub.cancel_at,
    });
    revalidatePath(`/admin/usuarios/${userId}`);
    revalidatePath('/admin/usuarios');
    return {
      ok: true,
      mensaje: 'La cuota se cancelará al terminar el periodo ya pagado. Hasta entonces sigue siendo afiliado.',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido cancelar la cuota.' };
  }
}
