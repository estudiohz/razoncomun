import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUsuarioYPerfil } from '@/lib/auth/niveles';

/** Bucket público de portadas (ver `infra/storage-blog.sql`). */
export const BUCKET_PORTADAS = 'articulos';

/**
 * Guard de rol editor.
 *
 * Se apoya en rc-03 (`getUsuarioYPerfil`, que lee el perfil real de la
 * petición y NUNCA un claim cacheado del JWT) y en la función `is_editor()`
 * de rc-02 — la misma que evalúan las políticas RLS. Panel y base de datos
 * comparten así una única definición de "editor"; si divergieran, manda RLS.
 *
 * El middleware de rc-03 ya exige sesión y 2FA para todo `/admin`. Esto es la
 * segunda capa, a nivel de dato. La tercera y definitiva es RLS.
 *
 * Vive fuera de `admin.ts` a propósito: aquel es un módulo `'use server'` y
 * solo puede exportar funciones async serializables. Este devuelve un cliente
 * de Supabase, que no lo es.
 */
export async function requireEditor(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const { supabase, user } = await getUsuarioYPerfil();
  if (!user) redirect('/entrar?next=/admin/articulos');

  const { data: esEditor } = await supabase.rpc('is_editor', { p_user: user.id });
  if (!esEditor) redirect('/perfil?error=sin-permiso-editor');

  return { supabase, userId: user.id };
}
