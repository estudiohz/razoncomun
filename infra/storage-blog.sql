-- infra/storage-blog.sql
--
-- Bucket público de portadas de artículos + sus políticas RLS.
--
-- CONTEXTO: `apps/web/src/lib/blog/guard.ts` declara
--   export const BUCKET_PORTADAS = 'articulos';
-- y remite a este fichero, pero el fichero NUNCA existió: ni el bucket ni las
-- políticas llegaron a crearse en ningún entorno. Resultado: `subirPortada()`
-- fallaba siempre con "Bucket not found" (comprobado el 2026-08-27 en dev,
-- producción y el servidor viejo). Las portadas que sí se ven vienen de la
-- importación de WordPress y viven en el bucket `blog`, no en `articulos`.
--
-- Idempotente: se puede aplicar varias veces sin efectos secundarios.

-- ── 1. El bucket ────────────────────────────────────────────────────────────
-- Sirve para dos cosas:
--   · portadas de artículo (`subirPortada()` valida además 5 MB e imagen)
--   · multimedia insertada en el cuerpo desde el editor visual
--
-- ⚠️ TECHO REAL: el Storage API aplica `STORAGE_FILE_SIZE_LIMIT` (50 MB) de la
-- config del stack POR ENCIMA de este valor. Subir el límite de aquí sin subir
-- también esa variable no sirve de nada. Y Cloudflare Free corta las subidas a
-- 100 MB, así que 50 MB es el máximo práctico mientras el proxy esté activo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'articulos', 'articulos', true, 52428800,
  array[
    -- imágenes
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
    -- vídeo (formatos que reproduce <video> en navegador sin plugins)
    'video/mp4', 'video/webm',
    -- documentos
    'application/pdf'
  ]
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Políticas RLS sobre storage.objects ──────────────────────────────────
-- `storage.objects` tiene RLS ACTIVO y, hasta ahora, CERO políticas: con RLS
-- activo y sin políticas, `authenticated` no puede hacer nada. Por eso no
-- bastaba con crear el bucket.
--
-- La subida usa el cliente del USUARIO (`requireEditor()` -> getUsuarioYPerfil),
-- no `service_role`, así que estas políticas son las que deciden de verdad.
-- Se apoyan en `public.is_editor(uuid)` (SECURITY DEFINER), la misma función
-- que evalúa el guard del panel: una única definición de "editor".

drop policy if exists "articulos_lectura_publica" on storage.objects;
create policy "articulos_lectura_publica" on storage.objects
  for select
  using (bucket_id = 'articulos');

drop policy if exists "articulos_insert_editor" on storage.objects;
create policy "articulos_insert_editor" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'articulos' and public.is_editor(auth.uid()));

drop policy if exists "articulos_update_editor" on storage.objects;
create policy "articulos_update_editor" on storage.objects
  for update to authenticated
  using (bucket_id = 'articulos' and public.is_editor(auth.uid()))
  with check (bucket_id = 'articulos' and public.is_editor(auth.uid()));

drop policy if exists "articulos_delete_editor" on storage.objects;
create policy "articulos_delete_editor" on storage.objects
  for delete to authenticated
  using (bucket_id = 'articulos' and public.is_editor(auth.uid()));

-- ── 3. Nota sobre los demás buckets ─────────────────────────────────────────
-- `blog`, `marca` y `email-templates` siguen SIN políticas a propósito: sus
-- objetos entraron con `service_role` (importación) y se sirven por la ruta
-- pública del Storage API, que no evalúa RLS. Si algún día se sube a ellos
-- desde el panel, necesitarán políticas equivalentes a las de arriba.
