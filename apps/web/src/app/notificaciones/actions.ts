'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { marcarNotificacionesLeidas } from '@/lib/participacion/notifications';

/**
 * Marca notificaciones propias como leídas (campanita del nav, D-P9).
 * Sin `ids` marca todas las no leídas; con `ids` marca solo esas. RLS exige
 * `user_id = auth.uid()`, reforzado aquí filtrando siempre por el usuario de
 * la sesión (nunca se confía en un id recibido del cliente sin ese filtro).
 */
export async function marcarNotificacionesLeidasAction(ids?: string[]): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await marcarNotificacionesLeidas(supabase, user.id, ids);
  revalidatePath('/', 'layout');
}
