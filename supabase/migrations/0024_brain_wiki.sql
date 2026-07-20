-- 0024_brain_wiki.sql
-- Wiki de conocimiento del RC-Brain (capa de autoría HUMANA, no la ingesta automática).
--
-- Modelo mental de Sergio (literal): "No vamos a publicar documentos. Vamos a subir
-- información como si fueran artículos. Los administradores irán alimentando el cerebro.
-- Las propuestas aprobadas por los afiliados pasarán a engrosar el cerebro."
--
-- Relación con brain_documents (0012): brain_documents es la capa de CHUNK+EMBEDDING,
-- cerrada a service_role, alimentada por el job de ingesta (lib/brain/ingest/). Esta
-- migración NO toca esa semántica ni sus políticas — solo amplía su CHECK de `source`
-- para que el futuro connector de la wiki (fuera de esta tarea, follow-up de rc-08) pueda
-- upsertear ahí sus chunks con source='conocimiento'. brain_entries es la fuente editable
-- por el equipo: título + cuerpo markdown, taxonomía propia (brain_categories) + área
-- temática (public.categories, el mismo catálogo de departamentos del blog, 0010).
--
-- Taxonomía elegida por Sergio: categoría propia del cerebro (brain_categories) + área
-- temática (categories.id de 0010_blog, nullable porque no todo documento de conocimiento
-- tiene departamento — p.ej. Estatutos).

begin;

-- ============================================================================
-- brain_categories: taxonomía propia de la wiki (NO confundir con public.categories,
-- que es el catálogo de departamentos del blog / área temática).
-- ============================================================================

create table public.brain_categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.brain_categories is
  'Taxonomía propia del RC-Brain para la wiki de conocimiento (brain_entries). Distinta de public.categories (departamentos del blog, usado aquí como "área temática").';

insert into public.brain_categories (slug, name, position) values
  ('ideario',              'Ideario',               0),
  ('estatutos',            'Estatutos',             1),
  ('programa',             'Programa',              2),
  ('preguntas-frecuentes', 'Preguntas frecuentes',  3),
  ('datos-y-estudios',     'Datos y estudios',      4)
on conflict (slug) do nothing;

-- ============================================================================
-- brain_entries: documentos de conocimiento ("como artículos"), autoría humana.
-- ============================================================================

create table public.brain_entries (
  id            uuid primary key default extensions.gen_random_uuid(),
  title         text not null,
  body          text not null,                 -- markdown
  category_id   uuid not null references public.brain_categories(id) on delete restrict,
  area_id       int  null references public.categories(id) on delete set null,   -- área temática = departamento del blog (0010)
  visibility    text not null default 'internal' check (visibility in ('internal', 'public')),
  origin        text not null default 'manual' check (origin in ('manual', 'proposal')),
  ref_id        uuid null,                      -- enlace a la propuesta origen si origin='proposal' (public.proposals.id)
  author_id     uuid null references public.profiles(id) on delete set null,
  indexed_at    timestamptz null,               -- cuándo se embebió al cerebro; null = pendiente de indexar
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.brain_entries is
  'Wiki de conocimiento editable por el equipo (admin/editor): la fuente humana que un connector de ingesta (rc-08, follow-up) volcará a brain_documents. No es "publicar documentos": son entradas tipo artículo con taxonomía propia + área temática.';
comment on column public.brain_entries.origin is
  '"manual" = cargada a mano por el equipo. "proposal" = propuesta ciudadana aprobada que pasa a engrosar el cerebro (ref_id apunta a public.proposals.id).';
comment on column public.brain_entries.indexed_at is
  'NULL = pendiente de (re)indexar en brain_documents. Se limpia automáticamente cuando cambia el contenido (ver trigger brain_entries_reset_indexed_at) y lo rellena el job de ingesta al terminar de embeber.';

create index brain_entries_category_idx   on public.brain_entries(category_id);
create index brain_entries_area_idx       on public.brain_entries(area_id);
create index brain_entries_visibility_idx on public.brain_entries(visibility);

create trigger brain_entries_set_updated_at
  before update on public.brain_entries
  for each row execute function public.set_updated_at();

-- Marca "pendiente de reindexar": si cambia el cuerpo o la visibilidad, el contenido ya
-- embebido en brain_documents queda desincronizado hasta el próximo paso de ingesta.
create or replace function public.brain_entries_reset_indexed_at()
returns trigger
language plpgsql
as $$
begin
  if new.body is distinct from old.body or new.visibility is distinct from old.visibility then
    new.indexed_at = null;
  end if;
  return new;
end;
$$;

comment on function public.brain_entries_reset_indexed_at() is
  'Trigger BEFORE UPDATE en brain_entries: si cambia body o visibility, pone indexed_at=NULL (pendiente de reindexar en brain_documents). El job de ingesta de la wiki (connector de rc-08, follow-up) es quien vuelve a rellenar indexed_at tras re-embeber.';

create trigger brain_entries_reset_indexed_at_trg
  before update on public.brain_entries
  for each row execute function public.brain_entries_reset_indexed_at();

-- ============================================================================
-- RLS: ambas tablas cerradas a anon. Lectura y escritura SOLO authenticated + is_editor().
-- El público nunca lee estas tablas directamente: interactúa vía el chat, que consulta
-- brain_documents con service_role y filtro visibility (I3, 0012).
-- ============================================================================

alter table public.brain_categories enable row level security;
alter table public.brain_entries    enable row level security;

create policy brain_categories_select_editor
  on public.brain_categories for select
  to authenticated
  using (public.is_editor());

create policy brain_categories_write_editor
  on public.brain_categories for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

create policy brain_entries_select_editor
  on public.brain_entries for select
  to authenticated
  using (public.is_editor());

create policy brain_entries_write_editor
  on public.brain_entries for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- Sin ninguna policy para `anon` a propósito -> RLS deniega todo (patrón de 0012_brain.sql).

-- ============================================================================
-- Amplía brain_documents.source para admitir 'conocimiento' (chunks de la wiki).
-- Se localiza el nombre real del constraint por catálogo en vez de asumirlo, por si
-- Postgres no lo llamó exactamente `brain_documents_source_check`.
-- ============================================================================

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.brain_documents'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%in%';

  if v_conname is not null then
    execute format('alter table public.brain_documents drop constraint %I', v_conname);
  end if;
end $$;

alter table public.brain_documents
  add constraint brain_documents_source_check
  check (source in ('manifiesto', 'estatutos', 'blog', 'decision', 'opinion', 'video', 'estudio', 'conocimiento'));

comment on constraint brain_documents_source_check on public.brain_documents is
  'Ampliado en 0024_brain_wiki.sql con el valor "conocimiento" para el futuro connector de ingesta de la wiki (brain_entries -> brain_documents, follow-up de rc-08).';

commit;
