import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrarAuditoria } from '@/lib/admin/audit';
import { ETIQUETA_ESTADO, votacionAbierta } from './types';
import type { EstadoPropuesta, Propuesta } from './types';
import { notificarCambioEstado, notificarRespuestaOficial } from './notifications-admin';

/**
 * Moderación de propuestas (P2 admin, rc-09). Cada función recibe el cliente
 * de SESIÓN del actor (`sesion`) — el trigger `proposals_protect_status`
 * (0005) sigue siendo la autoridad real que rechaza el cambio si el actor no
 * es coordinator/admin; aquí solo añadimos auditoría (I6, vía
 * `lib/admin/audit.ts`, mismo patrón que el resto del panel) y
 * notificaciones (D-P9).
 */

/** Cambia el estado (D-P3) y notifica a apoyos+seguidores (D-P9). */
export async function cambiarEstadoPropuesta(
  sesion: SupabaseClient,
  actorId: string,
  propuesta: Pick<Propuesta, 'id' | 'title' | 'slug' | 'status'>,
  nuevoEstado: EstadoPropuesta,
): Promise<void> {
  if (propuesta.status === nuevoEstado) return;

  const { error } = await sesion.from('proposals').update({ status: nuevoEstado }).eq('id', propuesta.id);
  if (error) throw error;

  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_status_change',
    entity: 'proposals',
    entityId: propuesta.id,
    meta: { desde: propuesta.status, hasta: nuevoEstado },
  });

  await notificarCambioEstado(sesion, propuesta.id, propuesta.title, ETIQUETA_ESTADO[nuevoEstado], propuesta.slug);
}

/** Fija/quita la fecha límite de votación (D-P6). */
export async function fijarDeadline(
  sesion: SupabaseClient,
  actorId: string,
  proposalId: string,
  deadlineAt: string | null,
): Promise<void> {
  const { error } = await sesion.from('proposals').update({ deadline_at: deadlineAt }).eq('id', proposalId);
  if (error) throw error;

  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_deadline_set',
    entity: 'proposals',
    entityId: proposalId,
    meta: { deadline_at: deadlineAt },
  });
}

/** Publica (o borra) la respuesta oficial fijada (D-P10) y notifica. */
export async function publicarRespuestaOficial(
  sesion: SupabaseClient,
  actorId: string,
  propuesta: Pick<Propuesta, 'id' | 'title' | 'slug'>,
  texto: string,
): Promise<void> {
  const { error } = await sesion
    .from('proposals')
    .update({
      official_response: texto,
      official_response_at: new Date().toISOString(),
      official_responder_id: actorId,
    })
    .eq('id', propuesta.id);
  if (error) throw error;

  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_official_response',
    entity: 'proposals',
    entityId: propuesta.id,
    meta: { longitud: texto.length },
  });

  await notificarRespuestaOficial(sesion, propuesta.id, propuesta.title, propuesta.slug);
}

/** Archiva (D-P3: soft, se conserva en BBDD, deja de verse en el front). */
export async function archivarPropuesta(sesion: SupabaseClient, actorId: string, proposalId: string): Promise<void> {
  const { error } = await sesion.from('proposals').update({ status: 'archived' }).eq('id', proposalId);
  if (error) throw error;
  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_archive',
    entity: 'proposals',
    entityId: proposalId,
  });
}

/** Elimina duro (policy admin ya existente). Requiere confirmación + motivo en la UI. */
export async function eliminarPropuestaDura(
  sesion: SupabaseClient,
  actorId: string,
  proposalId: string,
  motivo: string,
): Promise<void> {
  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_delete',
    entity: 'proposals',
    entityId: proposalId,
    meta: { motivo },
  });
  const { error } = await sesion.from('proposals').delete().eq('id', proposalId);
  if (error) throw error;
}

/**
 * Fusión de duplicados (D-P11): "fusionar B en A".
 * - Prohibido si A (destino) NO tiene la votación abierta (sumaría votos
 *   congelados) — se valida ANTES de tocar nada.
 * - Mueve supports de B a A (on-conflict do nothing vía upsert, dedupe por
 *   PK) usando el cliente service-role: la policy de `proposal_supports`
 *   solo permite insertar el apoyo PROPIO, y aquí se mueven apoyos de
 *   terceros por una acción legítima de admin.
 * - Mueve comentarios de B a A (update proposal_id) y copia follows.
 * - B pasa a `status='archived'` + `merged_into_id=A`.
 */
export async function fusionarPropuestas(
  sesion: SupabaseClient,
  actorId: string,
  origenId: string,
  destinoId: string,
): Promise<void> {
  if (origenId === destinoId) {
    throw new Error('No se puede fusionar una propuesta consigo misma.');
  }

  const { data: destino, error: eDestino } = await sesion
    .from('proposals')
    .select('id, status, deadline_at')
    .eq('id', destinoId)
    .single();
  if (eDestino) throw eDestino;
  if (!destino) throw new Error('La propuesta destino no existe.');

  if (!votacionAbierta(destino as Pick<Propuesta, 'status' | 'deadline_at'>)) {
    throw new Error(
      'La propuesta destino tiene la votación cerrada: fusionar sumaría votos congelados. Elige un destino con votación abierta.',
    );
  }

  const { data: origen, error: eOrigen } = await sesion
    .from('proposals')
    .select('id, status')
    .eq('id', origenId)
    .single();
  if (eOrigen) throw eOrigen;
  if (!origen) throw new Error('La propuesta origen no existe.');
  if (origen.status === 'archived') {
    throw new Error('Esa propuesta ya está archivada o fusionada.');
  }

  const admin = createAdminClient();

  // 1. Mover supports de B a A (dedupe por PK compuesto).
  const { data: supportsOrigen, error: eSupports } = await admin
    .from('proposal_supports')
    .select('user_id')
    .eq('proposal_id', origenId);
  if (eSupports) throw eSupports;

  if (supportsOrigen && supportsOrigen.length > 0) {
    const { error: eInsert } = await admin.from('proposal_supports').upsert(
      (supportsOrigen as { user_id: string }[]).map((s) => ({ proposal_id: destinoId, user_id: s.user_id })),
      { onConflict: 'proposal_id,user_id', ignoreDuplicates: true },
    );
    if (eInsert) throw eInsert;
  }

  // 2. Mover comentarios de B a A.
  const { error: eComentarios } = await admin
    .from('proposal_comments')
    .update({ proposal_id: destinoId })
    .eq('proposal_id', origenId);
  if (eComentarios) throw eComentarios;

  // 3. Copiar follows de B a A.
  const { data: followsOrigen, error: eFollows } = await admin
    .from('follows')
    .select('user_id')
    .eq('target_type', 'proposal')
    .eq('target_id', origenId);
  if (eFollows) throw eFollows;

  if (followsOrigen && followsOrigen.length > 0) {
    const { error: eInsertFollows } = await admin.from('follows').upsert(
      (followsOrigen as { user_id: string }[]).map((f) => ({
        user_id: f.user_id,
        target_type: 'proposal',
        target_id: destinoId,
      })),
      { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true },
    );
    if (eInsertFollows) throw eInsertFollows;
  }

  // 4. B -> archived + merged_into_id = A. Usa el cliente de sesión (respeta el
  // trigger de protección de status: exige coordinator/admin, igual que el resto).
  const { error: eArchivar } = await sesion
    .from('proposals')
    .update({ status: 'archived', merged_into_id: destinoId })
    .eq('id', origenId);
  if (eArchivar) throw eArchivar;

  await registrarAuditoria(sesion, {
    actorId,
    action: 'proposal_merge',
    entity: 'proposals',
    entityId: origenId,
    meta: { fusionada_en: destinoId },
  });
}
