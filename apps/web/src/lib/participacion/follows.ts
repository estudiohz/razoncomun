import type { SupabaseClient } from '@supabase/supabase-js';
import type { Propuesta } from './types';

const TARGET_TYPE = 'proposal';

/** ¿El usuario sigue este hilo? (`follows`, target_type='proposal' — 0014, D-P9). */
export async function usuarioSigue(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('user_id')
    .eq('user_id', userId)
    .eq('target_type', TARGET_TYPE)
    .eq('target_id', proposalId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Suscribe (idempotente: PK compuesto hace on-conflict silencioso). */
export async function suscribir(supabase: SupabaseClient, proposalId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .upsert(
      { user_id: userId, target_type: TARGET_TYPE, target_id: proposalId },
      { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function desuscribir(supabase: SupabaseClient, proposalId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', TARGET_TYPE)
    .eq('target_id', proposalId);
  if (error) throw error;
}

export async function alternarSuscripcion(
  supabase: SupabaseClient,
  proposalId: string,
  userId: string,
  siguiendoActualmente: boolean,
): Promise<void> {
  if (siguiendoActualmente) await desuscribir(supabase, proposalId, userId);
  else await suscribir(supabase, proposalId, userId);
}

/**
 * Hilos que el usuario sigue (para /propuestas/mias, pestaña "Sigo", D-P14).
 * `target_id` es polimórfico (sin FK real) — join manual en dos pasos.
 */
export async function listarPropuestasSeguidas(
  supabase: SupabaseClient,
  userId: string,
): Promise<Propuesta[]> {
  const { data: sigue, error } = await supabase
    .from('follows')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', TARGET_TYPE);
  if (error) throw error;
  const ids = (sigue ?? []).map((f) => (f as { target_id: string }).target_id);
  if (ids.length === 0) return [];
  const { data: propuestas, error: e2 } = await supabase.from('proposals').select('*').in('id', ids);
  if (e2) throw e2;
  return (propuestas ?? []) as Propuesta[];
}
