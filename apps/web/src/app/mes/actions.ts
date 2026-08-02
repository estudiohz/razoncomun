'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ResultadoRespuesta {
  ok: boolean;
  error?: string;
}

/**
 * Guarda (o cambia) la respuesta a UNA pregunta de la encuesta del mes.
 * Cada toque guarda al instante — no hay "enviar" final: eso es lo que hace
 * que responder a medias sea válido (decisión de diseño de Sergio).
 *
 * Update-primero y no upsert de PostgREST: el índice único de
 * survey_responses es PARCIAL (where user_id is not null) y la inferencia de
 * ON CONFLICT vía on_conflict= no puede usarlo. Carrera posible (dos pestañas
 * insertando a la vez) → el 23505 se resuelve reintentando como update.
 *
 * La autoridad es la RLS (0007 + 0041): audiencia, ventana abierta y "solo la
 * tuya". Aquí no se re-verifica nada de eso — se traduce el error.
 */
export async function responderPreguntaAction(
  surveyId: string,
  questionId: string,
  answer: string | string[],
): Promise<ResultadoRespuesta> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Inicia sesión para participar.' };

  const { data: actualizada, error: errorUpdate } = await supabase
    .from('survey_responses')
    .update({ answer })
    .eq('survey_id', surveyId)
    .eq('question_id', questionId)
    .eq('user_id', user.id)
    .select('id');

  if (errorUpdate) return { ok: false, error: traducir(errorUpdate.message) };

  if (!actualizada || actualizada.length === 0) {
    const { error: errorInsert } = await supabase.from('survey_responses').insert({
      survey_id: surveyId,
      question_id: questionId,
      user_id: user.id,
      answer,
    });

    if (errorInsert) {
      if (errorInsert.code === '23505') {
        // Carrera: otra pestaña insertó primero. Reintentar como update.
        const { error: e2 } = await supabase
          .from('survey_responses')
          .update({ answer })
          .eq('survey_id', surveyId)
          .eq('question_id', questionId)
          .eq('user_id', user.id);
        if (e2) return { ok: false, error: traducir(e2.message) };
      } else {
        return { ok: false, error: traducir(errorInsert.message) };
      }
    }
  }

  revalidatePath('/mes');
  revalidatePath('/panel');
  return { ok: true };
}

function traducir(m: string): string {
  if (/row-level security/i.test(m)) {
    return 'La encuesta está cerrada o tu cuenta no puede participar en ella.';
  }
  return 'No se ha podido guardar la respuesta. Inténtalo de nuevo.';
}
