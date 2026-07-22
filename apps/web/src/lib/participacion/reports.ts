import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cola de reportes (D-P15). El esquema (0032) no tiene columna de estado en
 * `proposal_reports` — "resuelto" se deriva: un reporte de propuesta se
 * considera resuelto cuando la propuesta reportada queda `archived`; uno de
 * comentario, cuando el comentario queda soft-deleted (`deleted_at`). Así el
 * badge de pendientes baja solo en cuanto se modera el objeto, sin tocar SQL.
 */
export interface FilaReporte {
  id: string;
  motivo: string;
  reporter_id: string;
  created_at: string;
  tipo: 'propuesta' | 'comentario';
  proposal_id: string | null;
  comment_id: string | null;
  titulo: string; // título de la propuesta, o extracto del comentario
  enlace: string; // ruta al hilo afectado
  abierto: boolean;
}

export async function listarReportes(supabase: SupabaseClient): Promise<FilaReporte[]> {
  const { data, error } = await supabase
    .from('proposal_reports')
    .select(
      '*, proposal:proposals(id, title, slug, status), comment:proposal_comments(id, body, deleted_at, proposal_id, proposal:proposals(slug))',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((fila: Record<string, unknown>) => {
    const proposal = fila.proposal as { id: string; title: string; slug: string | null; status: string } | null;
    const comment = fila.comment as
      | { id: string; body: string | null; deleted_at: string | null; proposal_id: string; proposal: { slug: string | null } | null }
      | null;

    if (proposal) {
      return {
        id: fila.id as string,
        motivo: fila.motivo as string,
        reporter_id: fila.reporter_id as string,
        created_at: fila.created_at as string,
        tipo: 'propuesta' as const,
        proposal_id: proposal.id,
        comment_id: null,
        titulo: proposal.title,
        enlace: proposal.slug ? `/propuestas/${proposal.slug}` : `/propuestas/${proposal.id}`,
        abierto: proposal.status !== 'archived',
      };
    }

    return {
      id: fila.id as string,
      motivo: fila.motivo as string,
      reporter_id: fila.reporter_id as string,
      created_at: fila.created_at as string,
      tipo: 'comentario' as const,
      proposal_id: comment?.proposal_id ?? null,
      comment_id: comment?.id ?? null,
      titulo: comment?.body ? comment.body.slice(0, 120) : '[comentario ya eliminado]',
      enlace: comment?.proposal?.slug ? `/propuestas/${comment.proposal.slug}` : '/propuestas',
      abierto: Boolean(comment && !comment.deleted_at),
    };
  });
}

export async function contarReportesAbiertos(supabase: SupabaseClient): Promise<number> {
  const filas = await listarReportes(supabase);
  return filas.filter((f) => f.abierto).length;
}
