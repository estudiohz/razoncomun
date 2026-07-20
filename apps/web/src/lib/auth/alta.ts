import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Claves de user_metadata que /registro adjunta en signUp()/signInWithOtp()
 * (options.data) para poder aplicarlas a `profiles` en el momento en que
 * exista sesión (justo después de verificar el token en /auth/confirm).
 * Prefijo rc_ para no chocar con metadata de proveedores OAuth.
 */
export const METADATA_ALTA = {
  consentimiento: 'rc_privacy_consent',
  newsletter: 'rc_newsletter_opt_in',
  nombre: 'rc_display_name',
} as const;

/**
 * Traslada la metadata recogida en el formulario de /registro (guardada por
 * GoTrue en auth.users.user_metadata desde el signUp/signInWithOtp original)
 * a la fila de `profiles` del usuario, PERO SOLO si aún no se aplicó
 * (idempotente: no pisa un privacy_consent_at ya existente).
 */
export async function aplicarMetadataAlta(supabase: SupabaseClient, user: User) {
  const meta = user.user_metadata ?? {};
  const consintio = meta[METADATA_ALTA.consentimiento] === true;
  if (!consintio) return;

  const { data: perfil } = await supabase
    .from('profiles')
    .select('privacy_consent_at')
    .eq('id', user.id)
    .single();

  if (perfil?.privacy_consent_at) return; // ya aplicado, no repetir

  const ahora = new Date().toISOString();
  const newsletter = meta[METADATA_ALTA.newsletter] === true;
  const nombre = typeof meta[METADATA_ALTA.nombre] === 'string' ? meta[METADATA_ALTA.nombre] : null;

  await supabase
    .from('profiles')
    .update({
      privacy_consent_at: ahora,
      newsletter_opt_in: newsletter,
      newsletter_opt_in_at: newsletter ? ahora : null,
      ...(nombre ? { display_name: nombre } : {}),
    })
    .eq('id', user.id);
}

/**
 * A dónde mandar al usuario tras verificar un token (email/OAuth):
 * - recovery: siempre a poner contraseña nueva.
 * - si todavía no dio el consentimiento Art. 9 (caso OAuth, o cualquier
 *   hueco): pasarela de consentimiento obligatoria antes de seguir.
 * - si no: la ruta `next` pedida (por defecto /perfil).
 */
export async function destinoTrasVerificar(
  supabase: SupabaseClient,
  userId: string,
  tipo: string,
  next: string,
): Promise<string> {
  if (tipo === 'recovery') {
    return `/recuperar/actualizar?next=${encodeURIComponent(next)}`;
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('privacy_consent_at')
    .eq('id', userId)
    .single();

  if (!perfil?.privacy_consent_at) {
    return `/registro/consentimiento?next=${encodeURIComponent(next)}`;
  }

  return next;
}
