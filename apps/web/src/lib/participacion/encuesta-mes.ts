import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * La encuesta del mes (0041). Capa de lectura para /mes y el panel.
 *
 * El guardado parcial NO es una feature añadida: cada respuesta es una fila
 * propia con índice único (survey_id, question_id, user_id), así que "hacer la
 * encuesta en 3 veces" es simplemente cómo funcionan los datos. El progreso es
 * un recuento.
 */
export interface PreguntaMes {
  id: string;
  position: number;
  kind: 'single' | 'multiple' | 'scale' | 'text';
  text: string;
  options: string[] | null;
  info: string | null;
  proposal_id: string | null;
  /** slug/título de la propuesta enlazada, si la hay (para "ver la discusión"). */
  proposal?: { title: string; slug: string | null } | null;
}

export interface EncuestaMes {
  id: string;
  title: string;
  description: string | null;
  opens_at: string;
  closes_at: string;
  results_visibility: 'live' | 'on_close' | 'internal';
  featured_month: string;
  preguntas: PreguntaMes[];
  /** Mis respuestas: question_id → answer (para pintar lo ya contestado). */
  misRespuestas: Map<string, unknown>;
  abierta: boolean;
}

export async function obtenerEncuestaDelMes(
  supabase: SupabaseClient,
  mes: string, // 'YYYY-MM'
  userId: string | null,
): Promise<EncuestaMes | null> {
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, title, description, opens_at, closes_at, results_visibility, featured_month')
    .eq('featured_month', `${mes}-01`)
    .maybeSingle();

  if (!survey) return null;

  const [{ data: preguntas }, respuestas] = await Promise.all([
    supabase
      .from('survey_questions')
      .select('id, position, kind, text, options, info, proposal_id, proposal:proposals(title, slug)')
      .eq('survey_id', survey.id)
      .order('position'),
    userId
      ? supabase
          .from('survey_responses')
          .select('question_id, answer')
          .eq('survey_id', survey.id)
          .eq('user_id', userId)
      : Promise.resolve({ data: [] as { question_id: string; answer: unknown }[] }),
  ]);

  const ahora = Date.now();
  return {
    ...survey,
    preguntas: ((preguntas ?? []) as unknown as (Omit<PreguntaMes, 'options'> & {
      options: { options?: string[] } | string[] | null;
    })[]).map((p) => ({
      ...p,
      // 0007 guarda options como {options:[...]}; se normaliza a array aquí
      // para que ningún consumidor tenga que conocer esa envoltura.
      options: Array.isArray(p.options) ? p.options : (p.options?.options ?? null),
      proposal: Array.isArray(p.proposal) ? (p.proposal[0] ?? null) : p.proposal,
    })),
    misRespuestas: new Map((respuestas.data ?? []).map((r) => [r.question_id, r.answer])),
    abierta:
      ahora >= new Date(survey.opens_at).getTime() && ahora <= new Date(survey.closes_at).getTime(),
  } as EncuestaMes;
}

export interface ResultadoOpcion {
  question_id: string;
  option_value: string;
  afiliados: number;
  simpatizantes: number;
}

/** Agregado segmentado (RPC 0041). Vacío si la visibilidad aún no lo permite. */
export async function resultadosEncuesta(
  supabase: SupabaseClient,
  surveyId: string,
): Promise<ResultadoOpcion[]> {
  const { data } = await supabase.rpc('survey_results', { p_survey_id: surveyId });
  return (data ?? []) as ResultadoOpcion[];
}

/** Progreso del usuario en la encuesta del mes: para la tarjeta del panel. */
export async function progresoEncuestaDelMes(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ titulo: string; respondidas: number; total: number; cierra: string } | null> {
  const hoy = new Date();
  const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const encuesta = await obtenerEncuestaDelMes(supabase, mes, userId);
  if (!encuesta || !encuesta.abierta || encuesta.preguntas.length === 0) return null;

  return {
    titulo: encuesta.title,
    respondidas: encuesta.misRespuestas.size,
    total: encuesta.preguntas.length,
    cierra: encuesta.closes_at,
  };
}
