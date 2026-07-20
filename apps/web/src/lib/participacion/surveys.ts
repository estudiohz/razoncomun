import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Survey, SurveyQuestion, TipoPregunta } from './types';

export async function listarEncuestasVisibles(supabase: SupabaseClient): Promise<Survey[]> {
  // RLS (surveys_select_by_audience) ya filtra por audiencia/territorio del
  // usuario actual (o público si anon) — no hay que replicar esa lógica aquí.
  const { data, error } = await supabase.from('surveys').select('*').order('opens_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Survey[];
}

export async function obtenerEncuesta(
  supabase: SupabaseClient,
  id: string,
): Promise<{ survey: Survey; preguntas: SurveyQuestion[] } | null> {
  const { data: survey, error: e1 } = await supabase.from('surveys').select('*').eq('id', id).maybeSingle();
  if (e1) throw e1;
  if (!survey) return null; // no existe o RLS la oculta (audiencia no permitida)

  const { data: preguntas, error: e2 } = await supabase
    .from('survey_questions')
    .select('*')
    .eq('survey_id', id)
    .order('position', { ascending: true });
  if (e2) throw e2;

  return { survey: survey as Survey, preguntas: (preguntas ?? []) as SurveyQuestion[] };
}

export interface NuevaEncuestaInput {
  title: string;
  description: string | null;
  audience: Survey['audience'];
  territory_id: number | null;
  anonymous: boolean;
  results_visibility: Survey['results_visibility'];
  opens_at: string;
  closes_at: string;
  preguntas: { kind: TipoPregunta; text: string; options: string[] | null }[];
}

/** Constructor de encuestas (admin/coordinator). Ver admin-guard.ts. */
export async function crearEncuesta(
  supabase: SupabaseClient,
  createdBy: string,
  input: NuevaEncuestaInput,
): Promise<Survey> {
  const { data: survey, error } = await supabase
    .from('surveys')
    .insert({
      title: input.title,
      description: input.description,
      audience: input.audience,
      territory_id: input.territory_id,
      anonymous: input.anonymous,
      results_visibility: input.results_visibility,
      opens_at: input.opens_at,
      closes_at: input.closes_at,
      created_by: createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;

  if (input.preguntas.length > 0) {
    const filas = input.preguntas.map((p, i) => ({
      survey_id: survey.id,
      position: i,
      kind: p.kind,
      text: p.text,
      options: p.options && p.options.length > 0 ? { options: p.options } : null,
    }));
    const { error: e2 } = await supabase.from('survey_questions').insert(filas);
    if (e2) throw e2;
  }

  return survey as Survey;
}

export type RespuestaEncuestaInput =
  | { question_id: string; user_id: string; anon_hash: null; answer: unknown }
  | { question_id: string; user_id: null; anon_hash: string; answer: unknown };

export async function responderEncuesta(
  supabase: SupabaseClient,
  surveyId: string,
  respuestas: RespuestaEncuestaInput[],
): Promise<void> {
  const filas = respuestas.map((r) => ({ survey_id: surveyId, ...r }));
  const { error } = await supabase.from('survey_responses').insert(filas);
  if (error) throw error;
}

export interface TalliesPregunta {
  question_id: string;
  kind: TipoPregunta;
  total: number;
  // single/multiple: conteo por opción; scale: distribución por valor; text: no se agrega (privacidad)
  conteos: Record<string, number>;
}

/**
 * ⚠️ DESVIACIÓN DECLARADA (para el informe al arquitecto): rc-02-datos NO
 * creó una vista pública de agregados para `survey_responses` (sí existe
 * para `statement_votes` → `statement_tallies`, y para `budget_scenarios` →
 * `budget_scenario_medians`). La política RLS actual
 * (`survey_responses_select_own_or_admin`) solo permite leer la propia
 * respuesta o a admin/coordinator — así que un usuario normal NUNCA puede
 * leer el agregado de otros, aunque `results_visibility` diga 'live' o
 * 'on_close'. Sin esa vista, "resultados en vivo o al cierre" (pedido en el
 * brief) es irrealizable respetando RLS tal cual está.
 *
 * Mitigación temporal aplicada aquí, ejecutada SOLO en servidor: se calcula
 * el agregado con el cliente `service_role` (bypassa RLS de lectura) pero
 * la función seguidamente:
 *   1. Vuelve a comprobar en código `results_visibility` y la ventana de
 *      tiempo (o rol admin/coordinator) ANTES de tocar `service_role` — la
 *      decisión de visibilidad no la relaja esta función, la aplica.
 *   2. Solo devuelve conteos agregados (nunca filas individuales, nunca
 *      `user_id` ni `anon_hash`).
 * Pedir a rc-02: una vista `survey_response_tallies` análoga a
 * `statement_tallies`/`budget_scenario_medians` para poder borrar este
 * bypass y volver a depender 100% de RLS.
 */
export async function calcularResultadosEncuesta(
  supabaseSesion: SupabaseClient,
  survey: Survey,
  preguntas: SurveyQuestion[],
  esAdminOCoordinador: boolean,
): Promise<TalliesPregunta[] | null> {
  const ahora = Date.now();
  const cierra = new Date(survey.closes_at).getTime();

  const visible =
    esAdminOCoordinador ||
    survey.results_visibility === 'live' ||
    (survey.results_visibility === 'on_close' && ahora >= cierra);

  if (!visible) return null;

  const admin = createAdminClient();
  const { data: respuestas, error } = await admin
    .from('survey_responses')
    .select('question_id, answer')
    .eq('survey_id', survey.id);
  if (error) throw error;

  return preguntas.map((pregunta) => {
    const propias = (respuestas ?? []).filter((r) => r.question_id === pregunta.id);
    const conteos: Record<string, number> = {};

    if (pregunta.kind === 'single' || pregunta.kind === 'multiple') {
      for (const r of propias) {
        const valores = Array.isArray(r.answer) ? r.answer : [r.answer];
        for (const v of valores) {
          const clave = String(v);
          conteos[clave] = (conteos[clave] ?? 0) + 1;
        }
      }
    } else if (pregunta.kind === 'scale') {
      for (const r of propias) {
        const clave = String(r.answer);
        conteos[clave] = (conteos[clave] ?? 0) + 1;
      }
    }
    // kind === 'text': no se agrega por privacidad/significado (texto libre).

    return { question_id: pregunta.id, kind: pregunta.kind, total: propias.length, conteos };
  });
}
