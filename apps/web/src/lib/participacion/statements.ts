import type { SupabaseClient } from '@supabase/supabase-js';
import type { Statement, StatementTally, ValorVotoAfirmacion } from './types';

/** Afirmaciones de una propuesta (modo Polis) + su recuento agregado. */
export async function listarAfirmaciones(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<{ statement: Statement; tally: StatementTally | null }[]> {
  const [{ data: statements, error: e1 }, { data: tallies, error: e2 }] = await Promise.all([
    supabase
      .from('statements')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('created_at', { ascending: true }),
    supabase.from('statement_tallies').select('*'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const talliesPorId = new Map<string, StatementTally>();
  for (const t of tallies ?? []) talliesPorId.set(t.statement_id, t as StatementTally);

  return ((statements ?? []) as Statement[]).map((statement) => ({
    statement,
    tally: talliesPorId.get(statement.id) ?? null,
  }));
}

/** Mi voto en cada afirmación de la propuesta (RLS: solo el propio, statement_votes_select_own). */
export async function misVotosAfirmaciones(
  supabase: SupabaseClient,
  statementIds: string[],
): Promise<Record<string, ValorVotoAfirmacion>> {
  if (statementIds.length === 0) return {};
  const { data, error } = await supabase
    .from('statement_votes')
    .select('statement_id, value')
    .in('statement_id', statementIds);
  if (error) throw error;
  const mapa: Record<string, ValorVotoAfirmacion> = {};
  for (const fila of data ?? []) mapa[fila.statement_id] = fila.value as ValorVotoAfirmacion;
  return mapa;
}

export async function anadirAfirmacion(
  supabase: SupabaseClient,
  proposalId: string,
  authorId: string,
  texto: string,
): Promise<Statement> {
  const { data, error } = await supabase
    .from('statements')
    .insert({ proposal_id: proposalId, author_id: authorId, text: texto })
    .select('*')
    .single();
  if (error) throw error;
  return data as Statement;
}

/** De acuerdo / en desacuerdo / paso. Upsert: se puede cambiar el voto (statement_votes_update_own). */
export async function votarAfirmacion(
  supabase: SupabaseClient,
  userId: string,
  statementId: string,
  valor: ValorVotoAfirmacion,
): Promise<void> {
  const { error } = await supabase
    .from('statement_votes')
    .upsert({ user_id: userId, statement_id: statementId, value: valor }, { onConflict: 'user_id,statement_id' });
  if (error) throw error;
}

/**
 * El "mejor argumento de cada lado" (vision-plataforma.md Pilar 3.8: mostrar
 * el steelman de cada postura antes de votar). Sin un módulo de curación
 * dedicado, se aproxima con la afirmación de mayor `agree_count` como el
 * argumento a favor más respaldado, y la de mayor `disagree_count` como el
 * argumento en contra más respaldado — ambos derivados de datos reales de
 * deliberación, nunca inventados.
 */
export function mejoresArgumentos(
  filas: { statement: Statement; tally: StatementTally | null }[],
): { favor: Statement | null; contra: Statement | null } {
  let favor: { statement: Statement; tally: StatementTally } | null = null;
  let contra: { statement: Statement; tally: StatementTally } | null = null;

  for (const fila of filas) {
    if (!fila.tally) continue;
    if (!favor || fila.tally.agree_count > favor.tally.agree_count) {
      if (fila.tally.agree_count > 0) favor = { statement: fila.statement, tally: fila.tally };
    }
    if (!contra || fila.tally.disagree_count > contra.tally.disagree_count) {
      if (fila.tally.disagree_count > 0) contra = { statement: fila.statement, tally: fila.tally };
    }
  }

  return { favor: favor?.statement ?? null, contra: contra?.statement ?? null };
}
