/**
 * lib/simulador/adminData.ts
 *
 * Lectura de `sim_parametros`/`sim_partidas` para el admin (`is_editor()` ve
 * TODO, publicado o no — RLS `sim_*_select_published_or_team`). Estas
 * funciones son las únicas que hablan con Supabase; el motor (`resolver`,
 * `rollup`, `evaluador`, `validacion`) sigue sin conocer la BD.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ambito, ModoRC, ModoValor, TipoPartida } from './tipos';

export interface ParametroRow {
  id: string;
  clave: string;
  nombre: string;
  unidad: string | null;
  anio: number;
  modo: ModoValor;
  formula: string | null;
  valor_actual: number | null;
  fuente_actual: string | null;
  valor_rc: number | null;
  nota_rc: string | null;
  es_palanca: boolean;
  palanca_min: number | null;
  palanca_max: number | null;
  publicado: boolean;
  orden: number;
}

export interface PartidaRow {
  id: string;
  parent_id: string | null;
  tipo: TipoPartida;
  nombre: string;
  ambito: Ambito;
  anio: number;
  actual_modo: ModoValor;
  actual_cents: number | null;
  actual_formula: string | null;
  fuente_actual: string | null;
  rc_modo: ModoRC;
  rc_cents: number | null;
  rc_pct: number | null;
  rc_formula: string | null;
  justificacion_rc: string | null;
  ministry_id: number | null;
  origen: 'manual' | 'propuesta';
  ref_propuesta_id: string | null;
  es_palanca: boolean;
  palanca_min: number | null;
  palanca_max: number | null;
  publicado: boolean;
  orden: number;
  color: string | null;
}

const SELECT_PARAMETROS =
  'id, clave, nombre, unidad, anio, modo, formula, valor_actual, fuente_actual, valor_rc, nota_rc, es_palanca, palanca_min, palanca_max, publicado, orden';

const SELECT_PARTIDAS =
  'id, parent_id, tipo, nombre, ambito, anio, actual_modo, actual_cents, actual_formula, fuente_actual, rc_modo, rc_cents, rc_pct, rc_formula, justificacion_rc, ministry_id, origen, ref_propuesta_id, es_palanca, palanca_min, palanca_max, publicado, orden, color';

export async function listarParametros(supabase: SupabaseClient): Promise<ParametroRow[]> {
  const { data, error } = await supabase.from('sim_parametros').select(SELECT_PARAMETROS).order('orden');
  if (error) throw error;
  return (data ?? []) as ParametroRow[];
}

export async function listarPartidas(supabase: SupabaseClient): Promise<PartidaRow[]> {
  const { data, error } = await supabase.from('sim_partidas').select(SELECT_PARTIDAS).order('orden');
  if (error) throw error;
  return (data ?? []) as PartidaRow[];
}

export async function obtenerPartida(supabase: SupabaseClient, id: string): Promise<PartidaRow | null> {
  const { data, error } = await supabase.from('sim_partidas').select(SELECT_PARTIDAS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as PartidaRow) ?? null;
}

/** Descendientes (a cualquier profundidad) de una partida, incluyendo la propia. */
export function subarbol(partidas: PartidaRow[], raizId: string): PartidaRow[] {
  const porPadre = new Map<string, PartidaRow[]>();
  for (const p of partidas) {
    if (p.parent_id) {
      if (!porPadre.has(p.parent_id)) porPadre.set(p.parent_id, []);
      porPadre.get(p.parent_id)!.push(p);
    }
  }
  const raiz = partidas.find((p) => p.id === raizId);
  if (!raiz) return [];
  const resultado: PartidaRow[] = [raiz];
  const pila = [raizId];
  while (pila.length) {
    const actual = pila.pop()!;
    for (const hijo of porPadre.get(actual) ?? []) {
      resultado.push(hijo);
      pila.push(hijo.id);
    }
  }
  return resultado;
}
