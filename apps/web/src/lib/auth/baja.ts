import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Baja de cuenta (0055). Decisión de Sergio (04/09/2026): dar de baja es
 * ANONIMIZAR, no borrar — el voto que emitió esa persona sigue contando en las
 * votaciones ya cerradas y sus comentarios siguen publicados, pero sin firma.
 *
 * Son DOS mitades y las dos hacen falta:
 *   1. SQL (`anonimizar_usuario`): vacía el perfil de datos personales.
 *   2. Auth (aquí): deja la cuenta inutilizable.
 * Con solo la primera, la persona seguiría entrando con su contraseña a un
 * panel que ya no la reconoce.
 *
 * Sobre el baneo: es lo que cierra el acceso por OAuth. Cambiar el email no
 * basta, porque la identidad de Google/Facebook sigue enlazada al mismo id de
 * usuario y "Entrar con Google" volvería a abrir la sesión. GoTrue rechaza la
 * sesión de una cuenta baneada venga por donde venga, así que el baneo es la
 * parte que de verdad corta, no el cambio de email.
 *
 * Y el email quemado no es cosmética: libera el email real para que esa persona
 * pueda registrarse otra vez desde cero, que es justo el caso de un alta que
 * salió mal. `auth.users.email` es único; sin liberarlo, el email quedaría
 * secuestrado para siempre por una cuenta que ya no existe para nadie.
 */

/** ~100 años. GoTrue no tiene "para siempre", así que se usa un plazo absurdo. */
const BANEO_INDEFINIDO = '876000h';

export const ETIQUETA_BAJA = 'Usuario dado de baja';

export interface ResultadoBaja {
  ok: boolean;
  /** true si la persona llegó a pagar cuota y se conservan NIF y espejo de Stripe. */
  retieneDatosFiscales?: boolean;
  error?: string;
}

/**
 * Deja la cuenta de `auth.users` inservible sin borrarla: email quemado,
 * contraseña aleatoria que nadie conoce, metadatos de OAuth vaciados (ahí es
 * donde Google y Facebook dejan el nombre y la foto) y baneo indefinido.
 */
async function neutralizarCuentaAuth(
  admin: SupabaseClient,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const quemado = `baja+${userId}@razoncomun.invalid`;
  const contrasenaAlAzar = `${crypto.randomUUID()}${crypto.randomUUID()}`;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: quemado,
    // Sin esto GoTrue mandaría un correo de confirmación a una dirección
    // `.invalid` que no existe, y dejaría la cuenta a medio cambiar.
    email_confirm: true,
    password: contrasenaAlAzar,
    user_metadata: {},
    app_metadata: {},
    ban_duration: BANEO_INDEFINIDO,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Da de baja una cuenta. El orden importa: primero se corta el acceso y
 * después se vacía el perfil. Si fuera al revés y fallara el paso de auth,
 * quedaría una persona con sesión válida sobre un perfil ya anónimo.
 */
export async function darDeBajaCuenta(
  admin: SupabaseClient,
  userId: string,
  motivo: string,
): Promise<ResultadoBaja> {
  const auth = await neutralizarCuentaAuth(admin, userId);
  if (!auth.ok) {
    return { ok: false, error: `No se pudo cerrar el acceso de la cuenta: ${auth.error}` };
  }

  const { data, error } = await admin.rpc('anonimizar_usuario', {
    p_user: userId,
    p_motivo: motivo,
  });

  if (error) return { ok: false, error: error.message };

  const resultado = (data ?? {}) as { ok?: boolean; motivo?: string; retiene_datos_fiscales?: boolean };
  if (!resultado.ok) {
    return { ok: false, error: resultado.motivo ?? 'La baja no se pudo completar.' };
  }

  return { ok: true, retieneDatosFiscales: Boolean(resultado.retiene_datos_fiscales) };
}

/**
 * ¿Esta cuenta no ha dejado nada detrás? Decide entre borrarla de verdad
 * (cuentas de prueba, altas fallidas) y darla de baja. Ante la duda —un error
 * de consulta— devuelve `false`: preferimos anonimizar de más que borrar algo
 * que sostenía un recuento.
 */
export async function puedeBorrarseSinRastro(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('puede_borrarse_sin_rastro', { p_user: userId });
  if (error) return false;
  return data === true;
}
