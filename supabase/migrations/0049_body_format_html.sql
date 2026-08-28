-- 0049_body_format_html.sql
--
-- Bandera de formato del cuerpo, para pasar el contenido de markdown a HTML
-- (decisión de Sergio, 28/08/2026: editor visual completo tipo WordPress con
-- colores, fuentes, alineación y tablas — cosas que markdown no puede expresar).
--
-- POR QUÉ UNA BANDERA Y NO UNA CONVERSIÓN A SECAS:
--   1. Permite migrar tabla a tabla y volver atrás fila a fila si algo sale mal.
--   2. El cerebro sigue recibiendo MARKDOWN desde el automatismo de n8n
--      (docs/cerebro/*.md). Si se asumiera "todo es HTML", ese contenido se
--      pintaría con las etiquetas en crudo.
--   3. Un import futuro puede traer markdown otra vez.
--
-- El renderizador elige según esta columna. Por defecto 'markdown', que es lo
-- que hay hoy: añadir la columna NO cambia el comportamiento de nada.

alter table public.articles
  add column if not exists body_format text not null default 'markdown'
  check (body_format in ('markdown', 'html'));

alter table public.brain_entries
  add column if not exists body_format text not null default 'markdown'
  check (body_format in ('markdown', 'html'));

alter table public.proposals
  add column if not exists body_format text not null default 'markdown'
  check (body_format in ('markdown', 'html'));

alter table public.manifesto_points
  add column if not exists body_format text not null default 'markdown'
  check (body_format in ('markdown', 'html'));

comment on column public.articles.body_format is
  'Formato de body: markdown (heredado) o html (editor visual). El renderizador elige segun este valor; ver apps/web/src/lib/blog/html.ts';
comment on column public.brain_entries.body_format is
  'Formato de body. OJO: el automatismo de n8n sigue escribiendo markdown aqui.';
