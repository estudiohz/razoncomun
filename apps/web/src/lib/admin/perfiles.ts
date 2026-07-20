import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Nombres a mostrar para un conjunto de ids de `profiles` — utilidad
 * genérica compartida por varias pantallas del panel (ajustes de IA,
 * ajustes de participación...) que necesitan mostrar "cambiado por X" sin
 * repetir el mismo round-trip en cada sitio. Usa el cliente `service_role`
 * porque algunas de esas pantallas (credenciales de IA) ya operan con ese
 * cliente por RLS; para pantallas que solo usan el cliente de sesión esto
 * también funciona (`profiles` es legible por administradores).
 */
export async function nombresPorId(ids: (string | null)[]): Promise<Map<string, string>> {
  const idsUnicos = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (idsUnicos.length === 0) return new Map();

  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('id, display_name, email').in('id', idsUnicos);

  const mapa = new Map<string, string>();
  for (const perfil of data ?? []) {
    mapa.set(perfil.id, perfil.display_name ?? perfil.email ?? perfil.id);
  }
  return mapa;
}
