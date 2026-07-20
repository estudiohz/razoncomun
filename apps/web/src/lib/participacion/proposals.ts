import type { SupabaseClient } from '@supabase/supabase-js';
import type { EstadoPropuesta, Propuesta } from './types';

export interface FiltrosPropuestas {
  status?: EstadoPropuesta;
  department?: string;
}

/** Tablero público tipo GHL Ideas. RLS: lectura pública (0005_program.sql). */
export async function listarPropuestas(
  supabase: SupabaseClient,
  filtros: FiltrosPropuestas = {},
): Promise<Propuesta[]> {
  let query = supabase
    .from('proposals')
    .select('*')
    .order('support_count', { ascending: false })
    .order('created_at', { ascending: false });

  if (filtros.status) query = query.eq('status', filtros.status);
  if (filtros.department) query = query.eq('department', filtros.department);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Propuesta[];
}

export async function obtenerPropuesta(
  supabase: SupabaseClient,
  id: string,
): Promise<Propuesta | null> {
  const { data, error } = await supabase.from('proposals').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // 0 filas
    throw error;
  }
  return data as Propuesta;
}

/** Departamentos con propuestas (para el filtro), derivado de datos reales. */
export async function listarDepartamentosConPropuestas(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('proposals').select('department');
  if (error) throw error;
  const unicos = new Set((data ?? []).map((r) => r.department as string));
  return Array.from(unicos).sort();
}

/**
 * Detección de duplicados al proponer (vision-plataforma.md Pilar 3.2).
 *
 * HOOK PARA rc-08: si `NEXT_PUBLIC_BRAIN_SIMILAR_ENDPOINT` (o el endpoint que
 * exponga rc-08 sobre `brain_documents`/embeddings de propuestas) existe,
 * llamarlo aquí primero y devolver sus resultados; con embeddings la
 * detección es semántica (sinónimos, redacción distinta, misma idea). Hasta
 * que ese endpoint exista, se usa un fallback de búsqueda de texto: ILIKE
 * sobre título/cuerpo con las palabras significativas de la consulta,
 * apoyado en el índice `proposals_title_trgm_idx` (gin_trgm_ops) que
 * rc-02-datos ya creó exactamente para este propósito.
 */
export async function buscarPropuestasSimilares(
  supabase: SupabaseClient,
  textoConsulta: string,
): Promise<Propuesta[]> {
  const palabras = textoConsulta
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 4)
    .slice(0, 6);

  if (palabras.length === 0) return [];

  const orFiltro = palabras
    .map((p) => `title.ilike.%${p}%,body.ilike.%${p}%`)
    .join(',');

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .or(orFiltro)
    .limit(5);

  if (error) throw error;
  return (data ?? []) as Propuesta[];
}

export interface NuevaPropuestaInput {
  title: string;
  body: string;
  department: string;
  estimated_cost_cents?: number | null;
}

/** Crea una propuesta como el usuario autenticado (RLS: author_id = auth.uid()). */
export async function crearPropuesta(
  supabase: SupabaseClient,
  authorId: string,
  input: NuevaPropuestaInput,
): Promise<Propuesta> {
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title: input.title,
      body: input.body,
      department: input.department,
      estimated_cost_cents: input.estimated_cost_cents ?? null,
      author_id: authorId,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Propuesta;
}

/** ¿El usuario actual ya apoya esta propuesta? */
export async function usuarioApoya(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('proposal_supports')
    .select('proposal_id')
    .eq('proposal_id', proposalId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Apoyo 1-clic (registered+). support_count se recalcula por trigger en BD. */
export async function alternarApoyo(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string,
  apoyaActualmente: boolean,
): Promise<void> {
  if (apoyaActualmente) {
    const { error } = await supabase
      .from('proposal_supports')
      .delete()
      .eq('proposal_id', proposalId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('proposal_supports')
      .insert({ proposal_id: proposalId, user_id: userId });
    if (error) throw error;
  }
}
