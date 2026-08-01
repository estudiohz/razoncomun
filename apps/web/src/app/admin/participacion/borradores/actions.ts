'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { cambiarEstadoPropuesta } from '@/lib/participacion/moderation';
import type { Propuesta } from '@/lib/participacion/types';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

/**
 * Publica un borrador: `draft` → `seed` (D-U5). A partir de ahí la propuesta
 * es pública y sigue el ciclo normal del tablero.
 *
 * El cambio de estado lo autoriza la BD, no esta función: el trigger
 * `proposals_protect_status` (0005) solo deja cambiar `status` a
 * coordinator/admin. El guard de aquí es UX (no enseñar el botón a quien no
 * puede), la autoridad real sigue estando en Postgres.
 */
export async function publicarBorradorAction(id: string): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador('/admin/participacion/borradores');

  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, slug, status')
    .eq('id', id)
    .single();

  if (error || !data) return { ok: false, error: 'Borrador no encontrado.' };

  const propuesta = data as Pick<Propuesta, 'id' | 'title' | 'slug' | 'status'>;
  if (propuesta.status !== 'draft') {
    return { ok: false, error: 'Esta propuesta ya no es un borrador.' };
  }

  try {
    await cambiarEstadoPropuesta(supabase, user.id, propuesta, 'seed');
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se ha podido publicar el borrador.',
    };
  }

  revalidatePath('/admin/participacion/borradores');
  revalidatePath('/admin/participacion');
  revalidatePath('/propuestas');
  return { ok: true };
}

/** Descarta un borrador sin publicarlo: `draft` → `archived`. */
export async function descartarBorradorAction(id: string): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador('/admin/participacion/borradores');

  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, slug, status')
    .eq('id', id)
    .single();

  if (error || !data) return { ok: false, error: 'Borrador no encontrado.' };

  const propuesta = data as Pick<Propuesta, 'id' | 'title' | 'slug' | 'status'>;
  if (propuesta.status !== 'draft') {
    return { ok: false, error: 'Esta propuesta ya no es un borrador.' };
  }

  try {
    await cambiarEstadoPropuesta(supabase, user.id, propuesta, 'archived');
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'No se ha podido descartar el borrador.',
    };
  }

  revalidatePath('/admin/participacion/borradores');
  revalidatePath('/admin/participacion');
  return { ok: true };
}
