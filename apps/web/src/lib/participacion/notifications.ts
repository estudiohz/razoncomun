import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lectura/actualización propia de `notifications` (D-P9, rc-06) — campanita
 * del nav público. RLS permite select/update `user_id = auth.uid()`; el
 * INSERT vive exclusivamente en `notifications-admin.ts` (service-role), que
 * NO se toca desde aquí.
 */
export interface Notificacion {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** Últimas notificaciones del usuario, más recientes primero. */
export async function listarNotificaciones(
  supabase: SupabaseClient,
  userId: string,
  limite = 15,
): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, kind, title, body, link, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as Notificacion[];
}

/** Contador de no leídas (para el badge de la campanita). */
export async function contarNoLeidas(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/** Marca como leídas: todas las no leídas del usuario, o una lista concreta de ids. */
export async function marcarNotificacionesLeidas(
  supabase: SupabaseClient,
  userId: string,
  ids?: string[],
): Promise<void> {
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (ids && ids.length > 0) query = query.in('id', ids);
  const { error } = await query;
  if (error) throw error;
}
