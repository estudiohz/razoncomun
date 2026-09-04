'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { esNombreCompleto } from '@/lib/afiliacion/consentimiento';

export type EstadoActualizarPerfil = {
  ok: boolean | null; // null = todavía no se ha enviado nada
  mensaje: string;
  // Eco de lo que quedó persistido de verdad en BD tras un guardado con
  // éxito. El formulario cliente (PerfilDatosForm.tsx) resincroniza su
  // estado local con ESTOS valores (no con las props iniciales del Server
  // Component) al recibir un `ok:true` — evita que el <select> muestre un
  // valor viejo si, por lo que sea, el re-render que sigue a
  // `revalidatePath` no llega a refrescar las props del cliente a tiempo
  // (BUG reportado por Sergio: el selector volvía a Albacete tras guardar
  // Navarra, aunque en BD y tras recargar la página sí quedaba Navarra).
  valores?: {
    display_name: string;
    legal_name: string;
    birth_date: string;
    origin_province_id: number | null;
    newsletter_opt_in: boolean;
    newsletter_opt_in_at: string | null;
  };
};

/**
 * Actualiza los campos NO sensibles del perfil propio. `level` no está en la
 * lista de columnas permitidas a propósito: está protegido por trigger en BD
 * (profiles_protect_level_trg) y esta acción ni lo intenta tocar.
 *
 * Firma (prevState, formData) para poder usarla con useActionState desde
 * PerfilDatosForm.tsx — así el formulario recibe SIEMPRE un resultado
 * explícito (antes el `.update()` se ignoraba en silencio: BUG reportado
 * por Sergio, el guardado parecía "no hacer nada").
 */
export async function actualizarPerfil(
  _prevState: EstadoActualizarPerfil,
  formData: FormData,
): Promise<EstadoActualizarPerfil> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const display_name = (formData.get('display_name') as string)?.trim() || null;

  // Nombre y apellidos (0057) y fecha de nacimiento (0058). Los dos son
  // OPCIONALES aquí: quien solo está registrado no tiene por qué darlos. Pero
  // si escribe algo, tiene que valer — un carnet o un certificado fiscal con
  // medio nombre no sirven, y una fecha inventada tampoco.
  const legal_name_raw = (formData.get('legal_name') as string)?.trim().replace(/\s+/g, ' ') || '';
  if (legal_name_raw && !esNombreCompleto(legal_name_raw)) {
    return {
      ok: false,
      mensaje: 'Escribe tu nombre y tus apellidos completos, o deja el campo vacío.',
    };
  }
  const legal_name = legal_name_raw || null;

  const birth_date_raw = (formData.get('birth_date') as string)?.trim() || '';
  if (birth_date_raw) {
    const fecha = new Date(`${birth_date_raw}T00:00:00Z`);
    const hoy = new Date();
    const hace120 = new Date(Date.UTC(hoy.getUTCFullYear() - 120, hoy.getUTCMonth(), hoy.getUTCDate()));
    if (Number.isNaN(fecha.getTime()) || fecha >= hoy || fecha <= hace120) {
      return { ok: false, mensaje: 'Esa fecha de nacimiento no es válida.' };
    }
  }
  const birth_date = birth_date_raw || null;
  const origin_province_raw = formData.get('origin_province_id') as string;
  const origin_province_id = origin_province_raw ? Number(origin_province_raw) : null;
  const newsletter_opt_in = formData.get('newsletter_opt_in') === 'on';

  const { data: perfilActual, error: errorLectura } = await supabase
    .from('profiles')
    .select('newsletter_opt_in, newsletter_opt_in_at')
    .eq('id', user.id)
    .single();

  if (errorLectura) {
    return { ok: false, mensaje: 'No hemos podido leer tu perfil. Inténtalo de nuevo.' };
  }

  const cambioNewsletter = perfilActual?.newsletter_opt_in !== newsletter_opt_in;
  const newsletter_opt_in_at = cambioNewsletter
    ? newsletter_opt_in
      ? new Date().toISOString()
      : null
    : (perfilActual?.newsletter_opt_in_at ?? null);

  const { data: filaActualizada, error: errorUpdate } = await supabase
    .from('profiles')
    .update({
      display_name,
      legal_name,
      birth_date,
      origin_province_id,
      newsletter_opt_in,
      ...(cambioNewsletter ? { newsletter_opt_in_at } : {}),
    })
    .eq('id', user.id)
    .select('display_name, legal_name, birth_date, origin_province_id, newsletter_opt_in, newsletter_opt_in_at')
    .single();

  if (errorUpdate || !filaActualizada) {
    return {
      ok: false,
      mensaje: 'No se ha podido guardar. Vuelve a intentarlo en unos segundos.',
    };
  }

  revalidatePath('/perfil');
  return { ok: true, mensaje: 'Guardado.', valores: filaActualizada };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

// ── Web Push (0046) ─────────────────────────────────────────────────────────

export interface SuscripcionPushInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Da de alta ESTE dispositivo/navegador para recibir Web Push y activa
 * `notification_preferences.push_enabled` (por si el usuario lo había
 * desactivado antes desde otro dispositivo). RLS de `push_subscriptions` es
 * 100% propia, así que basta el cliente de sesión — no hace falta admin.
 */
export async function guardarSuscripcionPushAction(
  sub: SuscripcionPushInput,
  userAgent: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sin sesión.' };

  const { error: errorSub } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' },
  );
  if (errorSub) return { ok: false, error: errorSub.message };

  const { error: errorPrefs } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: user.id, push_enabled: true }, { onConflict: 'user_id' });
  if (errorPrefs) return { ok: false, error: errorPrefs.message };

  return { ok: true };
}

/** Da de baja ESTE dispositivo. Si era el único, deja de recibir push (no toca los demás). */
export async function eliminarSuscripcionPushAction(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sin sesión.' };

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
