'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { crearEncuesta } from '@/lib/participacion/surveys';
import { notificarEncuestaNueva } from '@/lib/participacion/notifications-admin';
import type { TipoPregunta } from '@/lib/participacion/types';

export async function crearEncuestaAction(formData: FormData) {
  const { user, supabase } = await requireAdminOCoordinador('/admin/participacion/encuestas/nueva');

  const title = (formData.get('title') as string)?.trim();
  const description = (formData.get('description') as string)?.trim() || null;
  const audience = formData.get('audience') as 'public' | 'registered' | 'member';
  const territoryRaw = (formData.get('territory_id') as string)?.trim();
  const territory_id = territoryRaw ? Number(territoryRaw) : null;
  const anonymous = formData.get('anonymous') === 'on';
  const notifyPush = formData.get('notify_push') === 'on';
  const results_visibility = formData.get('results_visibility') as 'live' | 'on_close' | 'internal';
  const opens_at = formData.get('opens_at') as string;
  const closes_at = formData.get('closes_at') as string;

  const featuredRaw = (formData.get('featured_month') as string)?.trim() || null;
  if (featuredRaw && !/^\d{4}-\d{2}$/.test(featuredRaw)) {
    throw new Error('El mes destacado debe tener formato AAAA-MM.');
  }

  // La encuesta del mes NUNCA puede ser anónima, marque lo que marque el
  // formulario: el reproductor guarda cada respuesta con el usuario (es lo
  // que hace posible el parcial, el progreso y editar hasta el cierre), y la
  // RLS de una encuesta anónima rechaza justo eso. Sergio se topó con el
  // choque el 02/08/2026 ("la encuesta está cerrada o tu cuenta no puede
  // participar") con la demo creada con la casilla por defecto.
  const anonymousFinal = featuredRaw ? false : anonymous;

  const preguntasRaw = (formData.get('preguntas_json') as string) ?? '[]';
  const preguntasEntrada = JSON.parse(preguntasRaw) as {
    kind: TipoPregunta;
    text: string;
    options: string[] | null;
    info: string | null;
    proposal_ref: string | null; // slug, uuid o URL del hilo — se resuelve aquí
  }[];

  // Resolver la referencia de propuesta de cada pregunta (0041): quien monta
  // la encuesta pega el slug o la URL del hilo; guardar el uuid es cosa nuestra.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const preguntas = [];
  for (const p of preguntasEntrada) {
    let proposal_id: string | null = null;
    const ref = p.proposal_ref?.trim().replace(/\/+$/, '').split('/').pop() ?? null;
    if (ref) {
      if (UUID_RE.test(ref)) {
        proposal_id = ref;
      } else {
        const { data } = await supabase.from('proposals').select('id').eq('slug', ref).maybeSingle();
        if (!data) {
          throw new Error(`No se encuentra ninguna propuesta con el slug «${ref}» (pregunta: ${p.text.slice(0, 40)}…).`);
        }
        proposal_id = data.id;
      }
    }
    preguntas.push({ kind: p.kind, text: p.text, options: p.options, info: p.info, proposal_id });
  }

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
    anonymous: anonymousFinal,
    results_visibility,
    opens_at: new Date(opens_at).toISOString(),
    closes_at: new Date(closes_at).toISOString(),
    featured_month: featuredRaw,
    preguntas,
  });

  if (notifyPush) {
    // No debe tumbar la creación de la encuesta si el envío falla (VAPID sin
    // configurar en este entorno, red, etc.) — la encuesta ya está guardada.
    await notificarEncuestaNueva(title, encuesta.id, audience).catch(() => {});
  }

  revalidatePath('/admin/participacion/encuestas');
  redirect(`/admin/participacion/encuestas?creada=${encuesta.id}`);
}
