import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Baja con un clic de los avisos de participación (newsletter.md, D-N3).
 *
 * El enlace de cada correo lleva `?u=<user_id>&t=<firma>`: quien lo pulsa se
 * da de baja sin iniciar sesión (lo exige Gmail para `List-Unsubscribe`). La
 * firma impide dar de baja a otro cambiando el id.
 *
 * Clave: la service role de Supabase, con un prefijo propio para que la firma
 * no sirva en ningún otro sitio. Así no hay un secreto nuevo que acordarse de
 * poner en Dokploy (la lección de ANTIBOT_SECRET): si la app arranca, esa
 * variable ya existe. Mismo patrón que `lib/carnet/token.ts`.
 */
const PREFIJO = 'rc-avisos-correo:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firmar(userId: string): string | null {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return null;
  return createHmac('sha256', clave).update(PREFIJO + userId.toLowerCase()).digest('hex');
}

/** Token para el enlace de baja. Null si el entorno no tiene clave. */
export function tokenBaja(userId: string): string | null {
  return firmar(userId);
}

/** ¿Es legítimo el par (usuario, token)? Nunca lanza. */
export function tokenBajaValido(userId: string | null | undefined, token: string | null | undefined): boolean {
  if (!userId || !token || !UUID.test(userId) || !/^[0-9a-f]{64}$/i.test(token)) return false;
  const esperada = firmar(userId);
  if (!esperada) return false;
  const a = Buffer.from(token, 'hex');
  const b = Buffer.from(esperada, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** URL absoluta de baja para meter en el correo y en `List-Unsubscribe`. */
export function urlBaja(sitio: string, userId: string): string | null {
  const t = tokenBaja(userId);
  return t ? `${sitio.replace(/\/$/, '')}/baja-avisos?u=${userId}&t=${t}` : null;
}
