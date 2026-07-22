-- 0033_proposal_comments_soft_delete_policy.sql
-- Micro-migración de corrección para el tablero de propuestas (P2).
--
-- Hallazgo: 0032_tablero_propuestas.sql creó public.proposal_comments con
-- policies de SELECT (pública), INSERT (propio) y DELETE (propio o admin),
-- pero NO con policy de UPDATE. La función borrarComentario()
-- (apps/web/src/lib/participacion/comments.ts) hace un UPDATE para poner
-- deleted_at cuando el comentario tiene respuestas (soft-delete), usando el
-- cliente de sesión del propio usuario -- sin policy de UPDATE, RLS deniega
-- la operación silenciosamente (0 filas afectadas, sin error visible).
--
-- Coherente con D-P4 (sin edición de contenido de comentarios): el único
-- update legítimo a nivel de fila es el soft-delete del propio autor
-- (deleted_at) o una acción de moderación por un editor/admin. RLS a nivel
-- de fila no puede restringir la policy a "solo se puede tocar la columna
-- deleted_at" -- eso es responsabilidad de la capa de aplicación, que hoy
-- solo escribe esa columna. Es el patrón mínimo aceptable, igual que el
-- resto de policies de esta tabla en 0032.

begin;

create policy proposal_comments_update_own_or_admin
  on public.proposal_comments for update
  to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

comment on policy proposal_comments_update_own_or_admin on public.proposal_comments is
  '0033: permite al autor soft-borrar su propio comentario (deleted_at) o a un admin moderar. La app solo escribe deleted_at; RLS de fila no puede restringir por columna.';

commit;
