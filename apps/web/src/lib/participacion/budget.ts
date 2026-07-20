import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ministry } from './types';

export async function listarMinisterios(supabase: SupabaseClient): Promise<Ministry[]> {
  const { data, error } = await supabase.from('ministries').select('*').order('current_budget_cents', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ministry[];
}

export async function obtenerMinisterio(supabase: SupabaseClient, id: number): Promise<Ministry | null> {
  const { data, error } = await supabase.from('ministries').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Ministry) ?? null;
}

export interface GuardarEscenarioInput {
  allocation: Record<string, number>; // ministry_id (string) -> cents
  userId: string | null;
  anonHash: string | null;
}

/**
 * Guarda "mi presupuesto". RLS (budget_scenarios_insert_any): anon con anon_hash, o propio user_id.
 *
 * ⚠️ El `id` se genera aquí en la aplicación (en vez de dejar el default
 * `gen_random_uuid()` de la BD y releerlo con `.select().single()`) porque
 * Postgres evalúa las políticas de SELECT también para el RETURNING de un
 * INSERT — y `budget_scenarios_select_own_or_admin` es `to authenticated`
 * únicamente (no incluye `anon`). Con `.select()` el INSERT de una persona
 * anónima fallaría con 401/42501 aunque `budget_scenarios_insert_any` sí la
 * autorice a escribir (comprobado en pruebas end-to-end reales contra la
 * BD). Generando el id en el cliente evitamos depender de leer la fila
 * recién creada.
 */
export async function guardarEscenario(
  supabase: SupabaseClient,
  input: GuardarEscenarioInput,
): Promise<string> {
  const id = globalThis.crypto.randomUUID();
  const { error } = await supabase.from('budget_scenarios').insert({
    id,
    allocation: input.allocation,
    user_id: input.userId,
    anon_hash: input.userId ? null : input.anonHash,
  });
  if (error) throw error;
  return id;
}

/**
 * RLS de `budget_scenarios` (0008_budget_simulator.sql) solo permite leer el
 * propio escenario o a admin. Para poder renderizar la tarjeta compartible
 * de un escenario recién guardado a la propia persona que lo guardó (sea
 * anónima o no) esto ya funciona sin bypass: si es anon, el escenario no es
 * legible después (no hay policy de SELECT para anon) — se soluciona
 * devolviendo el objeto ya construido en el momento de guardar (ver Server
 * Action `guardarEscenarioAction`) en vez de releerlo de la BD.
 */
export async function obtenerEscenarioPropio(
  supabase: SupabaseClient,
  id: string,
): Promise<{ allocation: Record<string, number> } | null> {
  const { data, error } = await supabase.from('budget_scenarios').select('allocation').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as { allocation: Record<string, number> } | null;
}

export interface MedianaMinisterio {
  ministry_id: number;
  is_member: boolean;
  median_value: number;
  scenario_count: number;
}

/** "El Presupuesto de la Gente" — vista pública agregada (budget_scenario_medians). */
export async function obtenerAgregadoPresupuestoGente(
  supabase: SupabaseClient,
): Promise<MedianaMinisterio[]> {
  const { data, error } = await supabase.from('budget_scenario_medians').select('*');
  if (error) throw error;
  return (data ?? []) as MedianaMinisterio[];
}
