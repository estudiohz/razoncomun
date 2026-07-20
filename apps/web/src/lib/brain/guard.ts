import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';

/**
 * Guard de la wiki del cerebro (`brain_categories` / `brain_entries`).
 *
 * Mismo patrón que `lib/blog/guard.ts`: se apoya en `is_editor()` (rc-02),
 * la misma función que evalúan las políticas RLS de 0024_brain_wiki.sql
 * (`brain_categories_select_editor`, `brain_categories_write_editor`,
 * `brain_entries_select_editor`, `brain_entries_write_editor` — las cuatro
 * exigen `is_editor()`, sin distinción admin/editor ni para leer ni para
 * escribir). Panel y base de datos comparten así una única definición de
 * "quién alimenta el cerebro"; si divergieran, manda RLS.
 *
 * El middleware de rc-03 ya exige sesión y 2FA para todo `/admin`. Esto es
 * la segunda capa, a nivel de dato. La tercera y definitiva es RLS: aunque
 * alguien se saltara esta función con una llamada directa a la API de
 * PostgREST, las cuatro políticas de arriba seguirían bloqueando a
 * cualquiera que no sea `is_editor()`.
 */
export async function requireEditorCerebro(rutaVuelta = '/admin/cerebro'): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const { supabase, user } = await getUsuarioYPerfil();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(rutaVuelta)}`);

  const { data: esEditor } = await supabase.rpc('is_editor', { p_user: user.id });
  if (!esEditor) redirect('/perfil?error=sin-permiso-editor');

  return { supabase, userId: user.id };
}
