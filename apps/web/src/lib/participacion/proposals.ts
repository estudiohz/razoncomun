import type { SupabaseClient } from '@supabase/supabase-js';
import { slugificar } from '@/lib/blog/markdown';
import type { EstadoPropuesta, Propuesta } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pareceUuid(valor: string): boolean {
  return UUID_RE.test(valor);
}

export interface FiltrosPropuestas {
  status?: EstadoPropuesta;
  department?: string;
  categoryId?: string;
}

/** Tablero público tipo GHL Ideas. RLS: lectura pública, `archived` filtrado en RLS. */
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
  if (filtros.categoryId) query = query.eq('category_id', filtros.categoryId);

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

/** Resuelve por slug SEO (ruta canónica D-P12). */
export async function obtenerPropuestaPorSlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Propuesta | null> {
  const { data, error } = await supabase.from('proposals').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data as Propuesta) ?? null;
}

/** Genera un slug único a partir del título, con sufijo corto si colisiona (D-P12). */
export async function generarSlugUnico(supabase: SupabaseClient, titulo: string): Promise<string> {
  const base = slugificar(titulo) || 'propuesta';
  let candidato = base;
  for (let intento = 0; intento < 6; intento++) {
    const { data, error } = await supabase.from('proposals').select('id').eq('slug', candidato).maybeSingle();
    if (error) throw error;
    if (!data) return candidato;
    candidato = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
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

/** Crea una propuesta como el usuario autenticado (RLS: author_id = auth.uid()). Genera slug (D-P12). */
export async function crearPropuesta(
  supabase: SupabaseClient,
  authorId: string,
  input: NuevaPropuestaInput,
): Promise<Propuesta> {
  const slug = await generarSlugUnico(supabase, input.title);
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      title: input.title,
      body: input.body,
      department: input.department,
      estimated_cost_cents: input.estimated_cost_cents ?? null,
      author_id: authorId,
      slug,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Propuesta;
}

/** Cuántos hilos ha creado el usuario en las últimas 24h (rate-limit D-P8: 3/día). */
export async function contarPropuestasRecientes(
  supabase: SupabaseClient,
  authorId: string,
): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .gte('created_at', desde);
  if (error) throw error;
  return count ?? 0;
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
