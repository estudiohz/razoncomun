import { createAdminClient } from '@/lib/supabase/admin';
import { tokenBajaValido } from './baja';

/**
 * Cambia `avisos_correo` desde un enlace firmado (sin sesión). Lo usan la
 * página `/baja-avisos` y el POST one-click de `List-Unsubscribe`. Va con
 * service role porque quien pulsa no tiene por qué haber iniciado sesión; la
 * firma es la autorización.
 */
export async function fijarAvisosPorToken(
  userId: string | null,
  token: string | null,
  activar: boolean,
): Promise<boolean> {
  if (!tokenBajaValido(userId, token)) return false;
  const { error } = await createAdminClient()
    .from('profiles')
    .update({ avisos_correo: activar, avisos_correo_at: new Date().toISOString() })
    .eq('id', userId!);
  return !error;
}
