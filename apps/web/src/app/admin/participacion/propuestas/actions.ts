'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import {
  archivarPropuesta,
  cambiarEstadoPropuesta,
  eliminarPropuestaDura,
  fijarDeadline,
  fusionarPropuestas,
  publicarRespuestaOficial,
} from '@/lib/participacion/moderation';
import { DEPARTAMENTOS } from '@/lib/participacion/departments';
import type { EstadoPropuesta, Propuesta } from '@/lib/participacion/types';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

const ESTADOS_VALIDOS: EstadoPropuesta[] = [
  // 'draft' (0034): permite despublicar algo devolviéndolo a borrador, además
  // del camino normal borrador → seed al aprobar lo que manda el RC-bot.
  'draft',
  'seed',
  'deliberation',
  'stress_test',
  'voting',
  'planned',
  'adopted',
  'discarded',
  'archived',
];

async function obtenerPropuestaOrThrow(supabase: Awaited<ReturnType<typeof requireAdminOCoordinador>>['supabase'], id: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, slug, status')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error('Propuesta no encontrada.');
  return data as Pick<Propuesta, 'id' | 'title' | 'slug' | 'status'>;
}

/** Cambia el estado desde la ficha de moderación (D-P3). Trigger SQL exige coordinator/admin. */
export async function cambiarEstadoAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const nuevoEstado = String(fd.get('status') ?? '').trim() as EstadoPropuesta;
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) return { ok: false, error: 'Estado inválido.' };

  try {
    const propuesta = await obtenerPropuestaOrThrow(supabase, id);
    await cambiarEstadoPropuesta(supabase, user.id, propuesta, nuevoEstado);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido cambiar el estado.' };
  }

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  revalidatePath('/admin/participacion');
  return { ok: true };
}

/**
 * Fija o quita la propuesta de "la encuesta del mes" (0040). Input type=month
 * vacío = quitarla. El trigger proposals_protect_featured exige
 * coordinator/admin — aquí solo se da la mejor experiencia al error.
 */
export async function fijarMesAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const raw = String(fd.get('featured_month') ?? '').trim(); // "2026-08" o ""
  if (raw && !/^\d{4}-\d{2}$/.test(raw)) {
    return { ok: false, error: 'El mes debe tener formato AAAA-MM.' };
  }

  const { error } = await supabase
    .from('proposals')
    .update({ featured_month: raw ? `${raw}-01` : null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  revalidatePath('/mes');
  return { ok: true };
}

/** Fija o quita la fecha límite (D-P6). Input datetime-local vacío = sin límite. */
export async function fijarDeadlineAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const raw = String(fd.get('deadline_at') ?? '').trim();
  const deadlineAt = raw ? new Date(raw).toISOString() : null;

  try {
    await fijarDeadline(supabase, user.id, id, deadlineAt);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido fijar la fecha límite.' };
  }

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  return { ok: true };
}

/**
 * Corrige el departamento y/o la categoría (D-P2) de una propuesta ya publicada.
 * Sergio (07/08/2026): en el alta se puede olvidar elegir el desplegable de
 * departamento y queda con el primero de la lista sin que nadie lo note; hasta
 * ahora no había forma de arreglarlo después. category_id es opcional (vacío
 * = sin categoría en el tablero con colores); department es obligatorio.
 */
export async function editarClasificacionAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const department = String(fd.get('department') ?? '').trim();
  const categoryId = String(fd.get('category_id') ?? '').trim();

  if (!DEPARTAMENTOS.includes(department as (typeof DEPARTAMENTOS)[number])) {
    return { ok: false, error: 'Departamento inválido.' };
  }

  const { error } = await supabase
    .from('proposals')
    .update({ department, category_id: categoryId || null })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  revalidatePath('/admin/participacion');
  revalidatePath('/propuestas');
  return { ok: true };
}

/** Publica la respuesta oficial fijada (D-P10). Solo coordinator/admin (mismo trigger que status). */
export async function publicarRespuestaOficialAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const texto = String(fd.get('official_response') ?? '').trim();
  if (!texto) return { ok: false, error: 'La respuesta no puede estar vacía.' };

  try {
    const propuesta = await obtenerPropuestaOrThrow(supabase, id);
    await publicarRespuestaOficial(supabase, user.id, propuesta, texto);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido publicar la respuesta.' };
  }

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  return { ok: true };
}

/** Archiva (soft, D-P3). */
export async function archivarAction(id: string): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);
  try {
    await archivarPropuesta(supabase, user.id, id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido archivar.' };
  }
  revalidatePath(`/admin/participacion/propuestas/${id}`);
  revalidatePath('/admin/participacion');
  return { ok: true };
}

/** Elimina duro. Exige motivo (RGPD/trazabilidad — queda en audit_log antes del delete). */
export async function eliminarAction(id: string, motivo: string): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);
  const motivoLimpio = motivo.trim();
  if (!motivoLimpio) return { ok: false, error: 'El motivo es obligatorio para eliminar.' };

  try {
    await eliminarPropuestaDura(supabase, user.id, id, motivoLimpio);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido eliminar.' };
  }

  revalidatePath('/admin/participacion');
  redirect('/admin/participacion?eliminada=1');
}

/** Fusiona `id` (origen, "B") en `destinoId` (A). Rechaza si A tiene la votación cerrada (D-P11). */
export async function fusionarAction(id: string, fd: FormData): Promise<ResultadoAccion> {
  const { user, supabase } = await requireAdminOCoordinador(`/admin/participacion/propuestas/${id}`);

  const destinoRaw = String(fd.get('destino') ?? '').trim();
  if (!destinoRaw) return { ok: false, error: 'Indica el id o el slug de la propuesta destino.' };

  let destinoId = destinoRaw;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(destinoRaw)) {
    const { data, error } = await supabase.from('proposals').select('id').eq('slug', destinoRaw).maybeSingle();
    if (error || !data) return { ok: false, error: 'No se encuentra ninguna propuesta con ese slug.' };
    destinoId = data.id;
  }

  try {
    await fusionarPropuestas(supabase, user.id, id, destinoId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido fusionar.' };
  }

  revalidatePath(`/admin/participacion/propuestas/${id}`);
  revalidatePath('/admin/participacion');
  redirect(`/admin/participacion/propuestas/${destinoId}?fusionada=1`);
}
