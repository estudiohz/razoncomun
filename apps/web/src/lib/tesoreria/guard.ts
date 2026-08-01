import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';

/**
 * Guard de `/admin/tesoreria`. La autoridad real es la RLS de
 * `finance_movements` (policies `is_admin() or is_treasurer()`, 0023): esto es
 * routing para no enseñar el esqueleto de la sección a quien no toca.
 *
 * `is_treasurer()` (0003) ya existía desde el primer día — es el cargo
 * orgánico `treasurer` de `positions`, o un admin. No se inventa un rol nuevo.
 */
export async function requireTesoreria(rutaVuelta = '/admin/tesoreria') {
  const { user, perfil, supabase } = await requireUsuario(rutaVuelta);

  const [{ data: esAdmin }, { data: esTesorero }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: user.id }),
    supabase.rpc('is_treasurer', { p_user: user.id }),
  ]);

  if (!esAdmin && !esTesorero) redirect('/admin');

  return { user, perfil: perfil!, supabase, esAdmin: Boolean(esAdmin) };
}
