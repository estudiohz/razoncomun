'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import type { TipoPregunta } from '@/lib/participacion/types';

/**
 * Edición de encuestas (02/08/2026). Origen: Sergio intentó añadir preguntas
 * a la demo desde el móvil y descubrió que la edición NO existía — el admin
 * solo tenía "crear" y el listado enlazaba a la vista pública.
 *
 * Reglas de sellado (importan más que el CRUD):
 * - Con respuestas emitidas, el ENUNCIADO y las OPCIONES de una pregunta
 *   quedan sellados: cambiarlos reescribiría lo que la gente ya votó. La
 *   info ampliada y la propuesta enlazada sí son editables siempre.
 * - Eliminar una pregunta: solo sin respuestas (el FK lleva on delete
 *   cascade — se llevaría los votos por delante).
 * - Añadir preguntas con la encuesta abierta es legítimo: quienes ya
 *   completaron pasan a "parcial" y el panel les invita a volver.
 * - Audiencia y anonimato no se editan: cambiarlos a mitad de partido
 *   altera las reglas del juego (y romper el anonimato es irreversible).
 */
export interface ResultadoEdicion {
  ok: boolean;
  error?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolverPropuestaRef(
  supabase: Awaited<ReturnType<typeof requireAdminOCoordinador>>['supabase'],
  refBruta: string | null,
): Promise<string | null> {
  const ref = refBruta?.trim().replace(/\/+$/, '').split('/').pop() ?? null;
  if (!ref) return null;
  if (UUID_RE.test(ref)) return ref;
  const { data } = await supabase.from('proposals').select('id').eq('slug', ref).maybeSingle();
  if (!data) throw new Error(`No se encuentra ninguna propuesta con el slug «${ref}».`);
  return data.id;
}

export async function actualizarEncuestaAction(
  surveyId: string,
  fd: FormData,
): Promise<ResultadoEdicion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/encuestas/${surveyId}`);

  const title = String(fd.get('title') ?? '').trim();
  if (title.length < 6) return { ok: false, error: 'El título necesita al menos 6 caracteres.' };
  const description = String(fd.get('description') ?? '').trim() || null;
  const closesRaw = String(fd.get('closes_at') ?? '').trim();
  const visibility = String(fd.get('results_visibility') ?? '');
  const featured = String(fd.get('featured_month') ?? '').trim() || null;

  if (featured && !/^\d{4}-\d{2}$/.test(featured)) {
    return { ok: false, error: 'El mes destacado debe tener formato AAAA-MM.' };
  }
  if (!['live', 'on_close', 'internal'].includes(visibility)) {
    return { ok: false, error: 'Visibilidad de resultados inválida.' };
  }

  const cambios: Record<string, unknown> = {
    title,
    description,
    results_visibility: visibility,
    featured_month: featured ? `${featured}-01` : null,
    // La encuesta del mes es nominal SIEMPRE (misma regla que al crearla).
    ...(featured ? { anonymous: false } : {}),
  };
  if (closesRaw) cambios.closes_at = new Date(closesRaw).toISOString();

  const { error } = await supabase.from('surveys').update(cambios).eq('id', surveyId);
  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: 'Ya hay otra encuesta fijada en ese mes.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/participacion/encuestas/${surveyId}`);
  revalidatePath('/mes');
  return { ok: true };
}

export async function anadirPreguntaAction(
  surveyId: string,
  fd: FormData,
): Promise<ResultadoEdicion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/encuestas/${surveyId}`);

  const text = String(fd.get('text') ?? '').trim();
  if (!text) return { ok: false, error: 'La pregunta no puede estar vacía.' };
  const kind = String(fd.get('kind') ?? 'single') as TipoPregunta;
  const opciones = String(fd.get('options') ?? '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);
  if ((kind === 'single' || kind === 'multiple') && opciones.length < 2) {
    return { ok: false, error: 'Escribe al menos dos opciones (una por línea).' };
  }
  const info = String(fd.get('info') ?? '').trim() || null;

  let proposalId: string | null = null;
  try {
    proposalId = await resolverPropuestaRef(supabase, String(fd.get('proposal_ref') ?? ''));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const { data: maxPos } = await supabase
    .from('survey_questions')
    .select('position')
    .eq('survey_id', surveyId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('survey_questions').insert({
    survey_id: surveyId,
    position: (maxPos?.position ?? -1) + 1,
    kind,
    text,
    options: kind === 'single' || kind === 'multiple' ? { options: opciones } : null,
    info,
    proposal_id: proposalId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/participacion/encuestas/${surveyId}`);
  revalidatePath('/mes');
  revalidatePath('/panel');
  return { ok: true };
}

/**
 * Guardar una pregunta. Política de erratas (decisión de Sergio, 02/08):
 * - ENUNCIADO e info: editables SIEMPRE — corregir texto libre no toca votos.
 * - OPCIONES con votos: se pueden CORREGIR (mismo número, renombrado por
 *   posición) y los votos emitidos se MIGRAN al texto nuevo vía RPC 0044.
 *   Añadir o quitar opciones con votos sigue bloqueado: eso sí cambia las
 *   reglas del juego, no la ortografía.
 */
export async function guardarPreguntaAction(
  surveyId: string,
  questionId: string,
  fd: FormData,
): Promise<ResultadoEdicion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/encuestas/${surveyId}`);

  const { count } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('question_id', questionId);
  const conVotos = (count ?? 0) > 0;

  const text = String(fd.get('text') ?? '').trim();
  if (!text) return { ok: false, error: 'La pregunta no puede estar vacía.' };
  const info = String(fd.get('info') ?? '').trim() || null;
  let proposalId: string | null = null;
  try {
    proposalId = await resolverPropuestaRef(supabase, String(fd.get('proposal_ref') ?? ''));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const nuevas = String(fd.get('options') ?? '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean);

  const cambios: Record<string, unknown> = { text, info, proposal_id: proposalId };

  if (nuevas.length > 0) {
    if (conVotos) {
      const { data: fila } = await supabase
        .from('survey_questions')
        .select('options')
        .eq('id', questionId)
        .single();
      const viejas: string[] = Array.isArray(fila?.options)
        ? (fila?.options as string[])
        : ((fila?.options as { options?: string[] } | null)?.options ?? []);

      if (nuevas.length !== viejas.length) {
        return {
          ok: false,
          error: `Con ${count} voto${count === 1 ? '' : 's'} emitido${count === 1 ? '' : 's'} puedes corregir el texto de las opciones (los votos se migran solos), pero no añadir ni quitar: eran ${viejas.length} y has puesto ${nuevas.length}.`,
        };
      }

      // Renombrado por posición: los votos siguen a su opción corregida.
      for (let i = 0; i < viejas.length; i++) {
        if (viejas[i] !== nuevas[i]) {
          const { error: errorRen } = await supabase.rpc('survey_renombrar_opcion', {
            p_question: questionId,
            p_vieja: viejas[i],
            p_nueva: nuevas[i],
          });
          if (errorRen) return { ok: false, error: errorRen.message };
        }
      }
    }
    cambios.options = { options: nuevas };
  }

  const { error } = await supabase
    .from('survey_questions')
    .update(cambios)
    .eq('id', questionId)
    .eq('survey_id', surveyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/participacion/encuestas/${surveyId}`);
  revalidatePath('/mes');
  return { ok: true };
}

export async function eliminarPreguntaAction(
  surveyId: string,
  questionId: string,
): Promise<ResultadoEdicion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/encuestas/${surveyId}`);

  const { count } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('question_id', questionId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Tiene ${count} respuesta${count === 1 ? '' : 's'}: no se puede eliminar (se borrarían votos emitidos). Puedes editar su info o dejarla estar.`,
    };
  }

  const { error } = await supabase
    .from('survey_questions')
    .delete()
    .eq('id', questionId)
    .eq('survey_id', surveyId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/participacion/encuestas/${surveyId}`);
  revalidatePath('/mes');
  return { ok: true };
}
