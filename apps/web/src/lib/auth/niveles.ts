import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Nivel = 'registered' | 'member' | 'verified';

const ORDEN: Record<Nivel, number> = { registered: 1, member: 2, verified: 3 };

export type Perfil = {
  id: string;
  email: string | null;
  display_name: string | null;
  level: Nivel;
  origin_province_id: number | null;
  newsletter_opt_in: boolean;
  newsletter_opt_in_at: string | null;
  privacy_consent_at: string | null;
  member_since: string | null;
  identity_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Usuario + perfil de la petición actual, o null si no hay sesión.
 *
 * Importante (C2, revision-seguridad.md): `perfil.level` viene de una
 * consulta directa a `profiles` en el momento de la petición, NUNCA de un
 * claim del JWT (que puede llevar hasta ~1h desactualizado tras una baja).
 * Es la fuente de verdad correcta para decidir acceso a rutas/acciones.
 *
 * Va envuelto en `cache()` de React: dentro de UNA misma petición, el layout,
 * la página y cualquier guard que se llame por el camino comparten el
 * resultado en vez de repetir `auth.getUser()` + la lectura de `profiles`.
 * Eran dos idas y vueltas a Supabase por cada guard, y en el panel se
 * encadenan varios. `cache()` tiene el ámbito de la petición, así que esto NO
 * cachea nada entre usuarios ni entre peticiones: la comprobación de nivel
 * sigue siendo fresca en cada carga, que es justo lo que exige C2.
 */
export const getUsuarioYPerfil = cache(async function getUsuarioYPerfil(): Promise<{
  supabase: SupabaseClient;
  user: { id: string; email?: string } | null;
  perfil: Perfil | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, perfil: null };

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { supabase, user, perfil: (perfil as Perfil) ?? null };
});

/** Exige sesión iniciada; si no la hay, redirige a /entrar conservando la ruta de vuelta. */
export async function requireUsuario(rutaVuelta?: string) {
  const { user, perfil, supabase } = await getUsuarioYPerfil();
  if (!user) {
    redirect(rutaVuelta ? `/entrar?next=${encodeURIComponent(rutaVuelta)}` : '/entrar');
  }
  return { user: user!, perfil, supabase };
}

/**
 * Exige un nivel mínimo en la escalera registered < member < verified.
 * Guard reutilizable para Server Components / Server Actions de otros
 * agentes (rc-06 participación, rc-07 afiliación...).
 */
export async function requireNivel(minimo: Nivel, rutaVuelta?: string) {
  const { user, perfil, supabase } = await requireUsuario(rutaVuelta);
  const nivelActual = perfil?.level ?? 'registered';
  if (ORDEN[nivelActual] < ORDEN[minimo]) {
    redirect('/unete');
  }
  return { user, perfil: perfil!, supabase };
}

/** true si el nivel A cumple o supera el nivel B (para lógica de UI, no de guard crítico). */
export function nivelCumple(actual: Nivel | undefined | null, minimo: Nivel): boolean {
  return ORDEN[actual ?? 'registered'] >= ORDEN[minimo];
}

/**
 * true si el usuario tiene cargo orgánico vigente (`positions`, ended_at IS
 * NULL) o rol funcional admin/editor (I5, revision-seguridad.md). No hay
 * migración propia para esto (ver lib/auth/sql/0016...proposal.sql, no
 * aplicada): se resuelve con dos llamadas a funciones que rc-02 ya expuso
 * por RPC (is_admin/is_editor) + una lectura directa de `positions`.
 */
export async function requiereMfa(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const [{ data: esAdmin }, { data: esEditor }, { data: cargos }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: userId }),
    supabase.rpc('is_editor', { p_user: userId }),
    supabase.from('positions').select('id').eq('user_id', userId).is('ended_at', null).limit(1),
  ]);

  return Boolean(esAdmin) || Boolean(esEditor) || Boolean(cargos && cargos.length > 0);
}
