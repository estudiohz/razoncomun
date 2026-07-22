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
import type { EstadoPropuesta, Propuesta } from '@/lib/participacion/types';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

const ESTADOS_VALIDOS: EstadoPropuesta[] = [
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
  revalidatePath('/admin/participacion/propuestas');
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
  revalidatePath('/admin/participacion/propuestas');
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

  revalidatePath('/admin/participacion/propuestas');
  redirect('/admin/participacion/propuestas?eliminada=1');
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
  revalidatePath('/admin/participacion/propuestas');
  redirect(`/admin/participacion/propuestas/${destinoId}?fusionada=1`);
}
