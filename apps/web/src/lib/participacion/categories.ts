import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposalCategory } from './types';

/** Categorías del tablero (D-P2). RLS: lectura pública. */
export async function listarCategorias(supabase: SupabaseClient): Promise<ProposalCategory[]> {
  const { data, error } = await supabase
    .from('proposal_categories')
    .select('*')
    .order('orden', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProposalCategory[];
}

/** Contador de hilos por categoría (para el sidebar D-P14). No cuenta archived (RLS ya lo oculta). */
export async function contarPropuestasPorCategoria(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('proposals').select('category_id');
  if (error) throw error;
  const conteo: Record<string, number> = {};
  for (const fila of data ?? []) {
    const id = (fila as { category_id: string | null }).category_id;
    if (!id) continue;
    conteo[id] = (conteo[id] ?? 0) + 1;
  }
  return conteo;
}
