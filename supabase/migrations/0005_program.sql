-- 0005_program.sql
-- Sistema de leyes / programa vivo: proposals (tablero tipo GHL Ideas), statements y
-- statement_votes (deliberación estilo Polis). Incluye support_count mantenido por trigger
-- (nunca desde el cliente, revision-seguridad.md sugerencia 8) y el campo estimated_cost
-- pedido en vision-plataforma.md ("Implicaciones técnicas" / Coste estimado por propuesta).
--
-- ⚠️ DESVIACIÓN DECLARADA (a confirmar con el arquitecto): modelo-datos.md define
-- proposals.support_count pero NO define ninguna tabla de "quién apoya una propuesta"
-- (statement_votes vota AFIRMACIONES dentro de una propuesta, no la propuesta en sí).
-- Para poder implementar el trigger de support_count tal como pide el brief, se añade
-- aquí `proposal_supports` (user_id, proposal_id) como tabla mínima de apoyo 1-persona-1-voto
-- por propuesta ("apoyar propuestas" es un peldaño explícito de la escalera de fricción
-- mínima en vision-plataforma.md, Pilar 3.1). Si el diseño pretendía otra cosa, avisar a
-- rc-02 antes de que rc-06 construya la UI sobre esto.

begin;

create table public.proposals (
  id                  uuid primary key default extensions.gen_random_uuid(),
  title               text not null,
  body                text not null,
  department          text not null,      -- vivienda|sanidad|economia|...
  status              text not null default 'seed'
                        check (status in ('seed', 'deliberation', 'stress_test', 'voting', 'adopted', 'discarded')),
  support_count       int not null default 0,
  estimated_cost_cents bigint null,       -- vision-plataforma.md: coste/ahorro estimado (Consul Madrid)
  author_id           uuid references public.profiles(id),
  report_url          text null,          -- informe del test de estrés (público)
  adopted_point_id    int null references public.manifesto_points(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.proposals is 'Propuestas ("leyes") tipo GHL Ideas: seed->deliberation->stress_test->voting->adopted|discarded.';

create index proposals_department_idx on public.proposals(department);
create index proposals_status_idx on public.proposals(status);
create index proposals_author_idx on public.proposals(author_id);
-- Detección de duplicados al proponer (vision-plataforma.md, Pilar 3.2): búsqueda por similitud de texto.
create index proposals_title_trgm_idx on public.proposals using gin (title gin_trgm_ops);

create table public.statements (
  id          uuid primary key default extensions.gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  text        text not null,
  author_id   uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create index statements_proposal_idx on public.statements(proposal_id);

create table public.statement_votes (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  statement_id  uuid not null references public.statements(id) on delete cascade,
  value         smallint not null check (value in (-1, 0, 1)),
  voted_at      timestamptz not null default now(),
  primary key (user_id, statement_id)
);

create table public.proposal_supports (
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (proposal_id, user_id)
);

comment on table public.proposal_supports is 'Tabla añadida por rc-02 (no está en modelo-datos.md literal) para poder mantener proposals.support_count por trigger. Ver nota de desviación arriba.';

-- ============================================================================
-- support_count por trigger (nunca desde el cliente)
-- ============================================================================

create or replace function public.proposals_recount_supports()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.proposal_id, old.proposal_id);
  update public.proposals
    set support_count = (select count(*) from public.proposal_supports where proposal_id = target_id)
    where id = target_id;
  return null;
end;
$$;

create trigger proposal_supports_recount
  after insert or delete on public.proposal_supports
  for each row execute function public.proposals_recount_supports();

create trigger proposals_set_updated_at
  before update on public.proposals
  for each row execute function public.set_updated_at();

-- Solo coordinator/admin puede cambiar el status de una propuesta (moderación del tablero).
create or replace function public.proposals_protect_status()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not (public.is_coordinator() or public.is_admin()) then
    raise exception 'Solo coordinator/admin puede cambiar el estado de una propuesta';
  end if;
  return new;
end;
$$;

create trigger proposals_protect_status_trg
  before update on public.proposals
  for each row execute function public.proposals_protect_status();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.proposals enable row level security;
alter table public.statements enable row level security;
alter table public.statement_votes enable row level security;
alter table public.proposal_supports enable row level security;

-- proposals: lectura pública; crear: registered+ (cualquier autenticado); editar: autor
-- (mientras no esté en voting/adopted/discarded) o coordinator/admin (cualquier campo,
-- incluido el status, protegido además por el trigger anterior).
create policy proposals_select_public
  on public.proposals for select
  to anon, authenticated
  using (true);

create policy proposals_insert_registered
  on public.proposals for insert
  to authenticated
  with check (author_id = auth.uid());

create policy proposals_update_author_or_moderation
  on public.proposals for update
  to authenticated
  using (
    (author_id = auth.uid() and status in ('seed', 'deliberation'))
    or public.is_coordinator() or public.is_admin()
  )
  with check (
    (author_id = auth.uid() and status in ('seed', 'deliberation'))
    or public.is_coordinator() or public.is_admin()
  );

create policy proposals_delete_admin
  on public.proposals for delete
  to authenticated
  using (public.is_admin());

-- statements: lectura pública; crear: registered+; sin edición/borrado (aportación estable
-- para la deliberación, coherente con trazabilidad total del Pilar 4).
create policy statements_select_public
  on public.statements for select
  to anon, authenticated
  using (true);

create policy statements_insert_registered
  on public.statements for insert
  to authenticated
  with check (author_id = auth.uid());

-- statement_votes: lectura propia (modelo-datos.md); crear/actualizar: registered+, solo tu voto.
create policy statement_votes_select_own
  on public.statement_votes for select
  to authenticated
  using (user_id = auth.uid());

create policy statement_votes_insert_own
  on public.statement_votes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy statement_votes_update_own
  on public.statement_votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Vista agregada pública de tallies (sin user_id) para que la deliberación se pueda
-- visualizar sin exponer el voto individual de cada afirmación (statement_votes sí es "propia").
create view public.statement_tallies
  with (security_invoker = false) as
  select
    statement_id,
    count(*) filter (where value = 1)  as agree_count,
    count(*) filter (where value = -1) as disagree_count,
    count(*) filter (where value = 0)  as pass_count,
    count(*)                            as total_count
  from public.statement_votes
  group by statement_id;

grant select on public.statement_tallies to anon, authenticated;

-- proposal_supports: lectura pública (cuenta transparente); crear/borrar: registered+, solo el propio apoyo.
create policy proposal_supports_select_public
  on public.proposal_supports for select
  to anon, authenticated
  using (true);

create policy proposal_supports_insert_own
  on public.proposal_supports for insert
  to authenticated
  with check (user_id = auth.uid());

create policy proposal_supports_delete_own
  on public.proposal_supports for delete
  to authenticated
  using (user_id = auth.uid());

commit;
