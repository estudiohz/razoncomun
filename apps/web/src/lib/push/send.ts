import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Envío de Web Push (0046). Complementa a `notifications` (centro in-app,
 * ver notifications-admin.ts): mismo evento, un canal más. Usa siempre la
 * service role (RLS de `push_subscriptions` es 100% propia — el servidor
 * necesita leer las de terceros para poder avisarles).
 *
 * `notification_preferences.push_enabled` (0014) es el opt-in: si el usuario
 * no tiene fila todavía (nadie crea una por defecto al registrarse), se
 * respeta el DEFAULT de la columna, que es `true`.
 */

let configurado = false;

function asegurarVapid(): boolean {
  if (configurado) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configurado = true;
  return true;
}

export interface PayloadPush {
  title: string;
  body: string;
  /** Ruta relativa (p.ej. "/propuestas/mi-slug") a la que navega el clic en la notificación. */
  url: string;
}

/**
 * Manda push a los `userIds` dados que tengan push_enabled y al menos un
 * dispositivo suscrito. Nunca lanza por fallos de envío individuales (un
 * dispositivo caducado no debe tumbar el resto ni la acción que lo llama) —
 * las suscripciones que el navegador ya dio de baja (404/410) se borran.
 */
export async function enviarPush(admin: SupabaseClient, userIds: string[], payload: PayloadPush): Promise<void> {
  if (userIds.length === 0 || !asegurarVapid()) return;

  const { data: prefs, error: errorPrefs } = await admin
    .from('notification_preferences')
    .select('user_id, push_enabled')
    .in('user_id', userIds);
  if (errorPrefs) throw errorPrefs;

  const desactivados = new Set(
    (prefs ?? []).filter((p) => p.push_enabled === false).map((p) => p.user_id as string),
  );
  const habilitados = userIds.filter((id) => !desactivados.has(id));
  if (habilitados.length === 0) return;

  const { data: subs, error: errorSubs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', habilitados);
  if (errorSubs) throw errorSubs;
  if (!subs || subs.length === 0) return;

  const cuerpo = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          cuerpo,
        );
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        }
        // Otros errores (rate-limit, red…) se ignoran: un push perdido no es crítico
        // y el usuario sigue teniendo el aviso en el centro in-app.
      }
    }),
  );
}
