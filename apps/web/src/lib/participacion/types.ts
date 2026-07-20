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
  | 'adopted'
  | 'discarded';

export const ORDEN_ESTADOS: EstadoPropuesta[] = [
  'seed',
  'deliberation',
  'stress_test',
  'voting',
  'adopted',
  'discarded',
];

export const ETIQUETA_ESTADO: Record<EstadoPropuesta, string> = {
  seed: 'Propuesta',
  deliberation: 'En deliberación',
  stress_test: 'Test de estrés',
  voting: 'En votación',
  adopted: 'Adoptada',
  discarded: 'Descartada',
};

export interface Propuesta {
  id: string;
  title: string;
  body: string;
  department: string;
  status: EstadoPropuesta;
  support_count: number;
  estimated_cost_cents: number | null;
  author_id: string | null;
  report_url: string | null;
  adopted_point_id: number | null;
  created_at: string;
  updated_at: string;
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
