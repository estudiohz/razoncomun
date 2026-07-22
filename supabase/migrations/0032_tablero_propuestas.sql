-- 0032_tablero_propuestas.sql
-- Evolución del tablero de propuestas ("hilos" GHL Ideas) según
-- docs/tecnico/tablero-propuestas.md (decisiones D-P1..D-P15).
-- NO crea un segundo sistema de hilos: evoluciona public.proposals (D-P1).
--
-- Contenido:
--  1. proposal_categories + RLS + semilla desde department distinct + backfill category_id.
--  2. alter proposals: category_id, deadline_at, slug, official_response(_at/_er_id),
--     merged_into_id; CHECK de status ampliado con planned/archived.
--  3. proposal_comments + comment_likes + trigger recount de like_count + RLS (D-P4).
--  4. Trigger de congelación de proposal_supports fuera de votación abierta (D-P7).
--  5. proposal_reports + RLS (D-P15).
--  6. Índices de lectura/rate-limit.
--  7. Backfill de slug para propuestas existentes.
--  8. RIESGO Nº1 (sección 4 del doc): proposals_select_public pasa de using(true) a
--     ocultar archived a quien no sea editor -- debe resistir un curl directo a
--     PostgREST, no solo la UI.

begin;

-- ============================================================================
-- 1. proposal_categories
-- ============================================================================

create table public.proposal_categories (
  id          uuid primary key default extensions.gen_random_uuid(),
  nombre      text not null unique,
  color       text not null,   -- hex, paleta de marca (DonutChart.PALETA_FALLBACK)
  orden       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.proposal_categories is 'D-P2: categorías del tablero de propuestas, gestionadas en admin. Semilla desde proposals.department distinct.';

create trigger proposal_categories_set_updated_at
  before update on public.proposal_categories
  for each row execute function public.set_updated_at();

alter table public.proposal_categories enable row level security;

create policy proposal_categories_select_public
  on public.proposal_categories for select
  to anon, authenticated
  using (true);

create policy proposal_categories_write_editor
  on public.proposal_categories for all
  to authenticated
  using (public.is_editor())
  with check (public.is_editor());

-- Semilla: una categoría por cada department distinto ya presente en proposals,
-- color cíclico de la paleta de marca, orden estable alfabético.
with paleta(color, ord) as (
  values
    ('#8B30D9', 0), ('#C3369E', 1), ('#E8792F', 2), ('#2BC7E8', 3),
    ('#4CA637', 4), ('#E0A82E', 5), ('#1B3D9C', 6), ('#6F6F6F', 7)
),
depts as (
  select distinct department,
         row_number() over (order by department) - 1 as rn
  from public.proposals
  where department is not null
)
insert into public.proposal_categories (nombre, color, orden)
select d.department, p.color, d.rn
from depts d
join paleta p on p.ord = d.rn % 8
on conflict (nombre) do nothing;

-- ============================================================================
-- 2. alter proposals
-- ============================================================================

alter table public.proposals
  add column category_id            uuid null references public.proposal_categories(id),
  add column deadline_at             timestamptz null,
  add column slug                    text unique null,
  add column official_response       text null,
  add column official_response_at    timestamptz null,
  add column official_responder_id   uuid null references public.profiles(id),
  add column merged_into_id          uuid null references public.proposals(id);

comment on column public.proposals.category_id is 'D-P2: reemplaza en la UI nueva al department (texto libre), que queda deprecated pero no se borra.';
comment on column public.proposals.deadline_at is 'D-P6: fecha límite de votación. NULL = sin límite mientras el estado lo permita.';
comment on column public.proposals.slug is 'D-P12: slugificar(title) + sufijo corto si colisiona. Ruta canónica /propuestas/[slug].';
comment on column public.proposals.official_response is 'D-P10: respuesta oficial fijada, solo coordinator/admin.';
comment on column public.proposals.merged_into_id is 'D-P11: fusión de duplicados; B queda archived + merged_into_id=A.';

-- Backfill category_id mapeando por nombre = department.
update public.proposals p
  set category_id = c.id
  from public.proposal_categories c
  where c.nombre = p.department
    and p.category_id is null;

-- CHECK de status ampliado: se añade planned y archived (D-P3).
alter table public.proposals drop constraint proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in ('seed', 'deliberation', 'stress_test', 'voting', 'planned', 'adopted', 'discarded', 'archived'));

-- ============================================================================
-- 7. Backfill de slug para propuestas existentes (D-P12).
-- Sin extensión unaccent disponible: normalizamos vocales acentuadas + ñ a mano.
-- ============================================================================

with base as (
  select id, title,
    regexp_replace(
      trim(both '-' from
        regexp_replace(
          translate(
            lower(title),
            'áéíóúüñÁÉÍÓÚÜÑ',
            'aeiouunAEIOUUN'
          ),
          '[^a-z0-9]+', '-', 'g'
        )
      ),
      '-+', '-', 'g'
    ) as candidate
  from public.proposals
  where slug is null
),
numbered as (
  select id, candidate,
         row_number() over (partition by candidate order by id) as rn
  from base
)
update public.proposals p
  set slug = case
    when n.rn = 1 then coalesce(nullif(n.candidate, ''), 'propuesta-' || left(p.id::text, 8))
    else coalesce(nullif(n.candidate, ''), 'propuesta') || '-' || left(p.id::text, 8)
  end
  from numbered n
  where n.id = p.id;

-- ============================================================================
-- 3. proposal_comments + comment_likes
-- ============================================================================

create table public.proposal_comments (
  id          uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  parent_id   uuid null references public.proposal_comments(id),
  author_id   uuid not null references public.profiles(id),
  body        text not null,
  like_count  int not null default 0,
  deleted_at  timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.proposal_comments is 'D-P4: comentarios conversacionales del hilo, un solo nivel de respuesta (parent_id siempre apunta a un comentario raíz). Sin edición (trazabilidad, coherente con statements).';

create index proposal_comments_proposal_created_idx on public.proposal_comments(proposal_id, created_at);
create index proposal_comments_author_created_idx on public.proposal_comments(author_id, created_at);

create trigger proposal_comments_set_updated_at
  before update on public.proposal_comments
  for each row execute function public.set_updated_at();

create table public.comment_likes (
  comment_id  uuid not null references public.proposal_comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create or replace function public.proposal_comments_recount_likes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.comment_id, old.comment_id);
  update public.proposal_comments
    set like_count = (select count(*) from public.comment_likes where comment_id = target_id)
    where id = target_id;
  return null;
end;
$$;

create trigger comment_likes_recount
  after insert or delete on public.comment_likes
  for each row execute function public.proposal_comments_recount_likes();

alter table public.proposal_comments enable row level security;
alter table public.comment_likes enable row level security;

-- proposal_comments: lectura pública (el body de borrados se filtra en la query de
-- la app, no en RLS -- la fila debe seguir visible como hueco para hilos de respuesta).
create policy proposal_comments_select_public
  on public.proposal_comments for select
  to anon, authenticated
  using (true);

create policy proposal_comments_insert_own
  on public.proposal_comments for insert
  to authenticated
  with check (author_id = auth.uid());

create policy proposal_comments_delete_own_or_admin
  on public.proposal_comments for delete
  to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- comment_likes: lectura pública (transparencia); crear/borrar solo el propio like.
create policy comment_likes_select_public
  on public.comment_likes for select
  to anon, authenticated
  using (true);

create policy comment_likes_insert_own
  on public.comment_likes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy comment_likes_delete_own
  on public.comment_likes for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- 4. Congelación de proposal_supports fuera de votación abierta (D-P6/D-P7).
-- ============================================================================

create or replace function public.proposal_supports_check_open()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
  p_status  text;
  p_deadline timestamptz;
begin
  target_id := coalesce(new.proposal_id, old.proposal_id);

  select status, deadline_at into p_status, p_deadline
    from public.proposals where id = target_id;

  if p_status is null then
    raise exception 'Propuesta % no existe', target_id;
  end if;

  if p_status in ('adopted', 'discarded', 'archived')
     or (p_deadline is not null and p_deadline <= now()) then
    raise exception 'La votación de esta propuesta está cerrada; el apoyo no puede cambiar';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger proposal_supports_check_open_trg
  before insert or delete on public.proposal_supports
  for each row execute function public.proposal_supports_check_open();

-- ============================================================================
-- 5. proposal_reports (D-P15)
-- ============================================================================

create table public.proposal_reports (
  id            uuid primary key default extensions.gen_random_uuid(),
  proposal_id   uuid null references public.proposals(id) on delete cascade,
  comment_id    uuid null references public.proposal_comments(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id),
  motivo        text not null,
  created_at    timestamptz not null default now(),
  constraint proposal_reports_exactly_one_target check (
    (proposal_id is not null and comment_id is null)
    or (proposal_id is null and comment_id is not null)
  )
);

comment on table public.proposal_reports is 'D-P15: moderación reactiva. Un reporte por usuario/objeto reportado.';

create unique index proposal_reports_unique_proposal
  on public.proposal_reports(reporter_id, proposal_id) where proposal_id is not null;
create unique index proposal_reports_unique_comment
  on public.proposal_reports(reporter_id, comment_id) where comment_id is not null;

alter table public.proposal_reports enable row level security;

create policy proposal_reports_insert_own
  on public.proposal_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy proposal_reports_select_editor
  on public.proposal_reports for select
  to authenticated
  using (public.is_editor());

-- ============================================================================
-- 6. Índices adicionales
-- ============================================================================

create index proposals_category_idx on public.proposals(category_id);
create index proposals_status_deadline_idx on public.proposals(status, deadline_at);
create index proposals_author_created_idx on public.proposals(author_id, created_at);

-- ============================================================================
-- 8. RIESGO Nº1: proposals_select_public pasaba de using(true) a filtrar archived.
-- Debe resistir un curl directo a PostgREST (mismo razonamiento que C-1), no solo
-- confiar en que la UI no los muestre.
-- ============================================================================

drop policy proposals_select_public on public.proposals;

create policy proposals_select_public
  on public.proposals for select
  to anon, authenticated
  using (status <> 'archived' or public.is_editor());

commit;
