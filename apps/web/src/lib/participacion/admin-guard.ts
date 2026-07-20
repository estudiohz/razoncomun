import { redirect } from 'next/navigation';
import { requireUsuario } from '@/lib/auth/niveles';

/**
 * Guard propio de rc-06 para las rutas `/admin/participacion/*` (moderación
 * de propuestas, apertura de votaciones, constructor de encuestas). No se
 * toca `lib/auth/niveles.ts` (zona de rc-03): se reutiliza `requireUsuario`
 * y se consulta la MISMA función RPC `is_admin`/`is_coordinator` que ya usa
 * el resto del esquema (0003_identity.sql) — nada de lógica de permisos
 * propia, la autoridad sigue siendo la BD.
 */
export async function requireAdminOCoordinador(rutaVuelta?: string) {
  const { user, perfil, supabase } = await requireUsuario(rutaVuelta);

  const [{ data: esAdmin }, { data: esCoordinador }] = await Promise.all([
    supabase.rpc('is_admin', { p_user: user.id }),
    supabase.rpc('is_coordinator', { p_user: user.id }),
  ]);

  if (!esAdmin && !esCoordinador) {
    redirect('/perfil');
  }

  return { user, perfil: perfil!, supabase, esAdmin: Boolean(esAdmin) };
}
