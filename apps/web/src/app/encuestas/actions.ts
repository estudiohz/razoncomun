'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { obtenerEncuesta, responderEncuesta } from '@/lib/participacion/surveys';
import { hashAnonimo, obtenerOCrearAnonId } from '@/lib/participacion/anon';
import type { RespuestaEncuestaInput } from '@/lib/participacion/surveys';

export interface ResultadoRespuesta {
  ok: boolean;
  mensaje: string;
}

/**
 * `respuestas` llega como { [question_id]: answer } desde el formulario
 * cliente. La RLS (survey_responses_insert_by_audience) decide de verdad si
 * el envío se acepta (audiencia + ventana + anónima/con censo coherente).
 */
export async function responderEncuestaAction(
  surveyId: string,
  respuestas: Record<string, unknown>,
): Promise<ResultadoRespuesta> {
  const supabase = await createClient();
  const encuestaConPreguntas = await obtenerEncuesta(supabase, surveyId);
  if (!encuestaConPreguntas) return { ok: false, mensaje: 'Esta encuesta no está disponible.' };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let filas: RespuestaEncuestaInput[];

  if (encuestaConPreguntas.survey.anonymous) {
    const anonId = await obtenerOCrearAnonId();
    const anonHash = hashAnonimo(surveyId, anonId);
    filas = Object.entries(respuestas).map(([question_id, answer]) => ({
      question_id,
      user_id: null,
      anon_hash: anonHash,
      answer,
    }));
  } else {
    if (!user) return { ok: false, mensaje: 'Esta encuesta requiere sesión iniciada (no es anónima).' };
    filas = Object.entries(respuestas).map(([question_id, answer]) => ({
      question_id,
      user_id: user.id,
      anon_hash: null,
      answer,
    }));
  }

  try {
    await responderEncuesta(supabase, surveyId, filas);
  } catch (error) {
    const mensaje =
      error instanceof Error && error.message.includes('duplicate')
        ? 'Ya has respondido a esta encuesta.'
        : 'No se pudo registrar la respuesta.';
    return { ok: false, mensaje };
  }

  revalidatePath(`/encuestas/${surveyId}`);
  return { ok: true, mensaje: 'Respuesta registrada. Gracias por participar.' };
}
