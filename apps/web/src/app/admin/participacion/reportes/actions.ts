'use server';

import { revalidatePath } from 'next/cache';
import { requireAdminOrEditor } from '@/lib/admin/guard';
import { requireAdminOCoordinador } from '@/lib/participacion/admin-guard';
import { archivarPropuesta } from '@/lib/participacion/moderation';
import { registrarAuditoria } from '@/lib/admin/audit';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
}

/**
 * Resuelve un reporte en un clic (D-P15). No hay columna de estado en
 * `proposal_reports` (0032): "resuelto" se deriva archivando el objeto
 * reportado — ver `lib/participacion/reports.ts`.
 *
 * - Reporte de PROPUESTA: se archiva la propuesta (`status='archived'`).
 *   Usa el cliente de sesión: el trigger `proposals_protect_status` exige
 *   coordinator/admin, coherente con el resto de moderación de estado.
 * - Reporte de COMENTARIO: se soft/hard-borra el comentario. `proposal_comments`
 *   no tiene policy RLS de UPDATE (solo select/insert/delete propio o admin,
 *   ver 0032) — soft-delete (poner `deleted_at`) requiere el cliente
 *   service-role. Se usa aquí tras el guard de editor/admin de esta página.
 */
export async function resolverReporteAction(
  tipo: 'propuesta' | 'comentario',
  proposalId: string | null,
  commentId: string | null,
): Promise<ResultadoAccion> {
  if (tipo === 'propuesta') {
    if (!proposalId) return { ok: false, error: 'Reporte inválido.' };
    const { user, supabase } = await requireAdminOCoordinador('/admin/participacion/reportes');
    try {
      await archivarPropuesta(supabase, user.id, proposalId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'No se ha podido archivar la propuesta.' };
    }
    revalidatePath('/admin/participacion/reportes');
    return { ok: true };
  }

  if (!commentId) return { ok: false, error: 'Reporte inválido.' };
  const { user, supabase } = await requireAdminOrEditor('/admin/participacion/reportes');

  const { count, error: errorConteo } = await supabase
    .from('proposal_comments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', commentId);
  if (errorConteo) return { ok: false, error: `No se ha podido comprobar respuestas: ${errorConteo.message}` };

  const admin = createAdminClient();
  if ((count ?? 0) > 0) {
    const { error } = await admin
      .from('proposal_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) return { ok: false, error: `No se ha podido moderar el comentario: ${error.message}` };
  } else {
    const { error } = await admin.from('proposal_comments').delete().eq('id', commentId);
    if (error) return { ok: false, error: `No se ha podido moderar el comentario: ${error.message}` };
  }

  await registrarAuditoria(supabase, {
    actorId: user.id,
    action: 'proposal_comment_moderate_from_report',
    entity: 'proposal_comments',
    entityId: commentId,
  });

  revalidatePath('/admin/participacion/reportes');
  return { ok: true };
}
