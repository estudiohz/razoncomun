import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUsuario } from '@/lib/auth/niveles';

/**
 * Guard de las rutas de finanzas del admin (`/admin/afiliados/*`). Lectura
 * de `members` ya es "propia o tesorería/admin" en RLS
 * (`members_select_own_or_finance`, 0003_identity.sql) — este guard es la
 * capa de UX que evita renderizar el panel a quien de todos modos RLS
 * bloquearía en la query. Comprueba en BD vía RPC (`is_admin`/`is_treasurer`,
 * SECURITY DEFINER de rc-02), nunca el claim del JWT (mismo principio C2 que
 * `requireNivel`).
 */
export async function requireFinanzas(rutaVuelta = '/admin/afiliados') {
  const { user } = await requireUsuario(rutaVuelta);
  const supabase = await createClient();

  const [{ data: esAdmin }, { data: esTesorero }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: user.id }),
    supabase.rpc('is_treasurer', { p_user: user.id }),
  ]);

  if (!esAdmin && !esTesorero) {
    redirect('/perfil');
  }

  return { user, supabase, esAdmin: Boolean(esAdmin), esTesorero: Boolean(esTesorero) };
}
