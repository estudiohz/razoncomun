import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProposalComment } from './types';

export interface ComentarioConAutor extends ProposalComment {
  autor_nombre: string | null;
}

/**
 * Comentarios de un hilo (D-P4). Los borrados (`deleted_at`) se muestran como
 * "[comentario eliminado]" si tienen respuestas — el filtrado del `body` pasa
 * aquí, en la query, no en RLS (la fila sigue siendo visible como hueco).
 */
export async function listarComentarios(
  supabase: SupabaseClient,
  proposalId: string,
): Promise<ComentarioConAutor[]> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .select('*, autor:profiles(display_name)')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((fila) => {
    const f = fila as ProposalComment & { autor: { display_name: string | null } | null };
    return {
      ...f,
      autor_nombre: f.autor?.display_name ?? null,
      body: f.deleted_at ? null : f.body,
    };
  });
}

/** ¿Este comentario tiene respuestas? (para decidir soft-delete vs delete duro). */
export async function tieneRespuestas(supabase: SupabaseClient, commentId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('proposal_comments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', commentId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Cuántos comentarios ha escrito el usuario en la última hora (rate-limit D-P8: 20/hora). */
export async function contarComentariosRecientes(
  supabase: SupabaseClient,
  authorId: string,
): Promise<number> {
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('proposal_comments')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .gte('created_at', desde);
  if (error) throw error;
  return count ?? 0;
}

export async function anadirComentario(
  supabase: SupabaseClient,
  proposalId: string,
  authorId: string,
  body: string,
  parentId: string | null = null,
): Promise<ProposalComment> {
  const { data, error } = await supabase
    .from('proposal_comments')
    .insert({ proposal_id: proposalId, author_id: authorId, body, parent_id: parentId })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProposalComment;
}

/** Borra un comentario propio: duro si no tiene respuestas, soft-delete si sí las tiene. */
export async function borrarComentario(supabase: SupabaseClient, commentId: string): Promise<void> {
  if (await tieneRespuestas(supabase, commentId)) {
    const { error } = await supabase
      .from('proposal_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('proposal_comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function usuarioDioLike(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function alternarLike(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  yaLeDioLike: boolean,
): Promise<void> {
  if (yaLeDioLike) {
    const { error } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
    if (error) throw error;
  }
}
