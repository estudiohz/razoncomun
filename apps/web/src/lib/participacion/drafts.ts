import type { SupabaseClient } from '@supabase/supabase-js';
import type { Propuesta } from '@/lib/participacion/types';

/**
 * Borradores pendientes de revisión (D-U5, migración 0034).
 *
 * Las propuestas que entran por el RC-bot nacen con `status='draft'` — lo
 * fuerza un trigger en BD, no la app. Un borrador solo es visible para su
 * autor y para editores (policy `proposals_select_public` de 0034), así que
 * estas consultas devuelven [] para cualquier otro usuario sin necesidad de
 * filtrar por rol aquí: la RLS ya es el filtro.
 *
 * Publicar un borrador = pasarlo a `seed`, y eso solo lo puede hacer un
 * coordinator/admin (trigger `proposals_protect_status`, 0005). Un editor a
 * secas puede verlos pero no promocionarlos; el aviso está en la UI.
 */
export async function contarBorradores(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');
  if (error) return 0;
  return count ?? 0;
}

export async function listarBorradores(supabase: SupabaseClient): Promise<Propuesta[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Propuesta[];
}
