'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { crearEncuesta } from '@/lib/participacion/surveys';
import type { TipoPregunta } from '@/lib/participacion/types';

export async function crearEncuestaAction(formData: FormData) {
  const { user, supabase } = await requireAdminOCoordinador('/admin/participacion/encuestas/nueva');

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const audience = formData.get('audience') as 'public' | 'registered' | 'member';
  const territoryRaw = (formData.get('territory_id') as string)?.trim();
  const territory_id = territoryRaw ? Number(territoryRaw) : null;
  const anonymous = formData.get('anonymous') === 'on';
  const results_visibility = formData.get('results_visibility') as 'live' | 'on_close' | 'internal';
  const opens_at = formData.get('opens_at') as string;
  const closes_at = formData.get('closes_at') as string;

  const preguntasRaw = (formData.get('preguntas_json') as string) ?? '[]';
  const preguntas = JSON.parse(preguntasRaw) as { kind: TipoPregunta; text: string; options: string[] | null }[];

  if (!title || !audience || !results_visibility || !opens_at || !closes_at) {
    throw new Error('Faltan campos obligatorios de la encuesta.');
  }
  if (preguntas.length === 0) {
    throw new Error('La encuesta necesita al menos una pregunta.');
  }

  const encuesta = await crearEncuesta(supabase, user.id, {
    title,
    description,
    audience,
    territory_id,
    anonymous,
    results_visibility,
    opens_at: new Date(opens_at).toISOString(),
    closes_at: new Date(closes_at).toISOString(),
    preguntas,
  });

  revalidatePath('/admin/participacion/encuestas');
  redirect(`/admin/participacion/encuestas?creada=${encuesta.id}`);
}
