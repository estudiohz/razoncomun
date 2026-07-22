/**
 * Tipos compartidos del módulo de Participación (propuestas, deliberación,
 * votaciones, encuestas, presupuesto). Reflejan el esquema de rc-02-datos
 * (supabase/migrations/0005..0008, 0014) — no se modifica el esquema aquí.
 */

export type EstadoPropuesta =
  | 'seed'
  | 'deliberation'
  | 'stress_test'
  | 'voting'
  | 'planned'
  | 'adopted'
  | 'discarded'
  | 'archived';

/** Estados visibles en el front (D-P3: archived no tiene etiqueta ni aparece). */
export const ORDEN_ESTADOS: EstadoPropuesta[] = [
  'seed',
  'deliberation',
  'stress_test',
  'voting',
  'planned',
  'adopted',
  'discarded',
];

export const ETIQUETA_ESTADO: Record<EstadoPropuesta, string> = {
  seed: 'Propuesta',
  deliberation: 'En deliberación',
  stress_test: 'Test de estrés',
  voting: 'En votación',
  planned: 'Planeado',
  adopted: 'Aprobado',
  discarded: 'Rechazado',
  archived: 'Archivado',
};

export interface Propuesta {
  id: string;
  title: string;
  body: string;
  department: string;
  category_id: string | null;
  slug: string | null;
  deadline_at: string | null;
  official_response: string | null;
  official_response_at: string | null;
  official_responder_id: string | null;
  merged_into_id: string | null;
  status: EstadoPropuesta;
  support_count: number;
  estimated_cost_cents: number | null;
  author_id: string | null;
  report_url: string | null;
  adopted_point_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalCategory {
  id: string;
  nombre: string;
  color: string;
  orden: number;
}

export interface ProposalComment {
  id: string;
  proposal_id: string;
  parent_id: string | null;
  author_id: string | null;
  body: string | null;
  deleted_at: string | null;
  like_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Votación abierta (D-P6): condición de lectura reutilizada en todos lados
 * para decidir si apoyar/deliberar/Trending aplica. Debe reflejar
 * EXACTAMENTE la misma regla que el trigger de congelación en BD (D-P7) —
 * si se desincroniza, el trigger manda (es la autoridad real).
 */
export function votacionAbierta(
  p: Pick<Propuesta, 'status' | 'deadline_at'>,
  ahoraMs: number = Date.now(),
): boolean {
  if (p.status === 'adopted' || p.status === 'discarded' || p.status === 'archived') return false;
  if (p.deadline_at && new Date(p.deadline_at).getTime() <= ahoraMs) return false;
  return true;
}

export interface Statement {
  id: string;
  proposal_id: string;
  text: string;
  author_id: string | null;
  created_at: string;
}

export interface StatementTally {
  statement_id: string;
  agree_count: number;
  disagree_count: number;
  pass_count: number;
  total_count: number;
}

export type ValorVotoAfirmacion = -1 | 0 | 1;

export interface Vote {
  id: string;
  proposal_id: string;
  opens_at: string;
  closes_at: string;
  quorum: number;
  threshold: number;
  scope: 'department' | 'manifesto';
  created_by: string | null;
  created_at: string;
}

export type EleccionVoto = 'favor' | 'contra' | 'abstencion';

export const ETIQUETA_ELECCION: Record<EleccionVoto, string> = {
  favor: 'A favor',
  contra: 'En contra',
  abstencion: 'Abstención',
};

export interface Ballot {
  vote_id: string;
  user_id: string;
  choice: EleccionVoto;
  weight: 0 | 1; // 1 = vinculante, 0 = consultivo
  cast_at: string;
}

export type TipoPregunta = 'single' | 'multiple' | 'scale' | 'text';

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  audience: 'public' | 'registered' | 'member';
  territory_id: number | null;
  anonymous: boolean;
  results_visibility: 'live' | 'on_close' | 'internal';
  opens_at: string;
  closes_at: string;
  created_by: string | null;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  position: number;
  kind: TipoPregunta;
  text: string;
  options: { options?: string[]; min?: number; max?: number } | null;
}

export interface Ministry {
  id: number;
  name: string;
  current_budget_cents: number;
  note: string | null;
}

export interface BudgetScenario {
  id: string;
  user_id: string | null;
  anon_hash: string | null;
  allocation: Record<string, number>;
  created_at: string;
}
