import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Notificaciones in-app (D-P9) generadas por las acciones de MODERACIÓN de
 * rc-09 — cambio de estado y respuesta oficial. La notificación de
 * "comentario nuevo" y la campanita del nav público quedan para rc-06 (no se
 * tocan aquí).
 *
 * RLS de `notifications` NO permite insert a `authenticated` (0014:
 * "inserción SOLO service_role") — por eso estas funciones usan siempre
 * `createAdminClient()` internamente, nunca el cliente de sesión del actor.
 */

async function destinatarios(sesion: SupabaseClient, proposalId: string): Promise<string[]> {
  const [{ data: apoyos, error: e1 }, { data: seguidores, error: e2 }] = await Promise.all([
    sesion.from('proposal_supports').select('user_id').eq('proposal_id', proposalId),
    sesion
      .from('follows')
      .select('user_id')
      .eq('target_type', 'proposal')
      .eq('target_id', proposalId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const ids = new Set<string>();
  for (const fila of apoyos ?? []) ids.add((fila as { user_id: string }).user_id);
  for (const fila of seguidores ?? []) ids.add((fila as { user_id: string }).user_id);
  return Array.from(ids);
}

/** (1) Cambio de estado — a todos los que apoyaron + seguidores (D-P9 evento 2). */
export async function notificarCambioEstado(
  sesion: SupabaseClient,
  proposalId: string,
  tituloPropuesta: string,
  etiquetaEstado: string,
  slug: string | null,
): Promise<void> {
  const ids = await destinatarios(sesion, proposalId);
  if (ids.length === 0) return;

  const admin = createAdminClient();
  const link = slug ? `/propuestas/${slug}` : `/propuestas/${proposalId}`;
  const { error } = await admin.from('notifications').insert(
    ids.map((userId) => ({
      user_id: userId,
      kind: 'proposal_status_changed',
      title: `«${tituloPropuesta}» ha cambiado a: ${etiquetaEstado}`,
      body: 'La propuesta que apoyaste o sigues ha cambiado de estado.',
      link,
      channel: 'in_app' as const,
    })),
  );
  if (error) throw error;
}

/** (2) Respuesta oficial publicada — mismo público que el cambio de estado (D-P10 + D-P9 evento 3). */
export async function notificarRespuestaOficial(
  sesion: SupabaseClient,
  proposalId: string,
  tituloPropuesta: string,
  slug: string | null,
): Promise<void> {
  const ids = await destinatarios(sesion, proposalId);
  if (ids.length === 0) return;

  const admin = createAdminClient();
  const link = slug ? `/propuestas/${slug}` : `/propuestas/${proposalId}`;
  const { error } = await admin.from('notifications').insert(
    ids.map((userId) => ({
      user_id: userId,
      kind: 'proposal_official_response',
      title: `Respuesta oficial en «${tituloPropuesta}»`,
      body: 'Se ha publicado una respuesta oficial en una propuesta que apoyaste o sigues.',
      link,
      channel: 'in_app' as const,
    })),
  );
  if (error) throw error;
}

/**
 * (3) Comentario nuevo (D-P9 evento 1, rc-06) — a los SEGUIDORES del hilo
 * (`follows`, no a quien solo apoyó), excluyendo a quien acaba de comentar.
 * Dedupe por Set; misma vía service-role que (1) y (2) porque RLS de
 * `notifications` no admite insert de `authenticated`.
 */
export async function notificarComentarioNuevo(
  sesion: SupabaseClient,
  proposalId: string,
  tituloPropuesta: string,
  autorComentarioId: string,
  slug: string | null,
): Promise<void> {
  const { data: seguidores, error } = await sesion
    .from('follows')
    .select('user_id')
    .eq('target_type', 'proposal')
    .eq('target_id', proposalId);
  if (error) throw error;

  const ids = Array.from(
    new Set((seguidores ?? []).map((fila) => (fila as { user_id: string }).user_id)),
  ).filter((id) => id !== autorComentarioId);
  if (ids.length === 0) return;

  const admin = createAdminClient();
  const link = slug ? `/propuestas/${slug}` : `/propuestas/${proposalId}`;
  const { error: errorInsert } = await admin.from('notifications').insert(
    ids.map((userId) => ({
      user_id: userId,
      kind: 'proposal_new_comment',
      title: `Nuevo comentario en «${tituloPropuesta}»`,
      body: 'Alguien ha comentado en una propuesta que sigues.',
      link,
      channel: 'in_app' as const,
    })),
  );
  if (errorInsert) throw errorInsert;
}
