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
 * ¿Esta sesión se ha quedado a medias de 2FA? (aal1 teniendo un factor TOTP
 * verificado). Entrar por enlace mágico, invitación o recuperación produce
 * SIEMPRE una sesión aal1: GoTrue no encadena el desafío del segundo factor.
 *
 * Importa más de lo que parece: con MFA activo, GoTrue rechaza cambiar email o
 * contraseña desde una sesión aal1 con
 * `401 insufficient_aal` ("AAL2 session is required to update email or password
 * when MFA is enabled"). Sin esta comprobación el usuario aterriza con una
 * sesión que sirve para leer pero no para tocar sus credenciales, y el error
 * que ve —traducido -- es un confuso "tu sesión ha caducado".
 *
 * (Bug real reportado por Sergio, 31/07/2026: entraba por enlace mágico, iba a
 * crear su contraseña y siempre fallaba. Tenía TOTP verificado.)
 */
export async function faltaCompletar2FA(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  } catch {
    // Ante la duda, no bloquear el acceso: la puerta dura la ponen el
    // middleware (para /admin) y el propio GoTrue (para credenciales).
    return false;
  }
}

/**
 * A dónde mandar al usuario tras verificar un token (email/OAuth):
 * - recovery / invite: siempre a poner contraseña nueva. En una invitación de
 *   equipo (admin crea la cuenta desde el panel) el usuario aún NO tiene
 *   contraseña, así que hay que llevarlo a establecerla igual que en recovery.
 * - si todavía no dio el consentimiento Art. 9 (caso OAuth, o cualquier
 *   hueco): pasarela de consentimiento obligatoria antes de seguir.
 * - si no: la ruta `next` pedida (por defecto /panel).
 *
 * Y por encima de todo lo anterior: si le falta completar el 2FA, primero el
 * desafío. Se envuelve el destino ya calculado en `?next=`, así que el usuario
 * acaba donde iba, solo que con una sesión aal2 que sí le permite operar.
 */
export async function destinoTrasVerificar(
  supabase: SupabaseClient,
  userId: string,
  tipo: string,
  next: string,
): Promise<string> {
  const destino = await destinoBase(supabase, userId, tipo, next);

  if (await faltaCompletar2FA(supabase)) {
    return `/entrar/2fa?next=${encodeURIComponent(destino)}`;
  }

  return destino;
}

async function destinoBase(
  supabase: SupabaseClient,
  userId: string,
  tipo: string,
  next: string,
): Promise<string> {
  if (tipo === 'recovery' || tipo === 'invite') {
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
