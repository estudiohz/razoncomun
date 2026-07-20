import { cookies } from 'next/headers';
import { createHash, randomUUID } from 'node:crypto';

const COOKIE_ANON_ID = 'rc_anon_id';

/**
 * Identificador anónimo estable por navegador (cookie httpOnly, 1 año). No es
 * un dato personal (RGPD): es un UUID aleatorio sin vínculo a identidad, solo
 * sirve para el `anon_hash` anti-duplicado de encuestas anónimas y escenarios
 * de presupuesto (esquema de rc-02: `survey_responses.anon_hash`,
 * `budget_scenarios.anon_hash`). Se hashea junto al recurso para que el mismo
 * navegador no pueda deducirse entre una encuesta y otra.
 */
export async function obtenerOCrearAnonId(): Promise<string> {
  const jar = await cookies();
  const existente = jar.get(COOKIE_ANON_ID)?.value;
  if (existente) return existente;

  const nuevo = randomUUID();
  try {
    jar.set(COOKIE_ANON_ID, nuevo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  } catch {
    // Server Component puro: no puede escribir cookies. El middleware no
    // refresca esta cookie (no es de sesión Supabase), así que en ese caso
    // se genera un id "de un solo uso" para esta petición — el hash resultante
    // simplemente no deduplicará entre visitas hasta que una Server Action
    // consiga fijar la cookie.
  }
  return nuevo;
}

/** Hash anti-duplicado: nunca reversible al anon_id ni a la persona. */
export function hashAnonimo(recursoId: string, anonId: string): string {
  return createHash('sha256').update(`${recursoId}:${anonId}`).digest('hex');
}
