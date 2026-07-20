-- 0007_surveys.sql
-- Encuestas (constructor desde el admin): surveys, survey_questions, survey_responses.

begin;

create table public.surveys (
  id                  uuid primary key default extensions.gen_random_uuid(),
  title               text not null,
  description         text,
  audience            text not null check (audience in ('public', 'registered', 'member')),
  territory_id        int null references public.territories(id),
  anonymous           boolean not null default true,
  results_visibility  text not null default 'on_close' check (results_visibility in ('live', 'on_close', 'internal')),
  opens_at            timestamptz not null,
  closes_at           timestamptz not null,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  constraint surveys_window_chk check (closes_at > opens_at)
);

create table public.survey_questions (
  id          uuid primary key default extensions.gen_random_uuid(),
  survey_id   uuid not null references public.surveys(id) on delete cascade,
  position    int not null,
  kind        text not null check (kind in ('single', 'multiple', 'scale', 'text')),
  text        text not null,
  options     jsonb null
);

create index survey_questions_survey_idx on public.survey_questions(survey_id);

create table public.survey_responses (
  id           uuid primary key default extensions.gen_random_uuid(),
  survey_id    uuid not null references public.surveys(id) on delete cascade,
  question_id  uuid not null references public.survey_questions(id) on delete cascade,
  user_id      uuid null references public.profiles(id),   -- NULL si anónima
  anon_hash    text null,                                    -- hash anti-duplicado cuando es anónima
  answer       jsonb not null,
  created_at   timestamptz not null default now(),
  constraint survey_responses_identity_chk check (
    (user_id is not null and anon_hash is null) or (user_id is null and anon_hash is not null)
  )
);

create index survey_responses_survey_idx on public.survey_responses(survey_id);
create unique index survey_responses_anon_dedupe_uidx
  on public.survey_responses(survey_id, question_id, anon_hash) where anon_hash is not null;
create unique index survey_responses_user_dedupe_uidx
  on public.survey_responses(survey_id, question_id, user_id) where user_id is not null;

-- ============================================================================
-- Helpers de audiencia
-- ============================================================================

create or replace function public.user_community_territory(p_user uuid)
returns int
language sql stable security definer set search_path = public as $$
  select t.parent_id
  from public.profiles p
  join public.territories t on t.id = p.origin_province_id
  where p.id = p_user;
$$;

create or replace function public.survey_audience_allowed(p_survey_id uuid, p_user uuid default auth.uid())
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_audience text;
  v_territory int;
begin
  select audience, territory_id into v_audience, v_territory
  from public.surveys where id = p_survey_id;

  if v_audience is null then
    return false;
  end if;

  if v_audience = 'public' then
    -- todavía puede filtrar por territorio
    null;
  elsif p_user is null then
    return false;
  elsif v_audience = 'member' and not public.is_active_member(p_user) then
    return false;
  end if;

  if v_territory is not null then
    if p_user is null or public.user_community_territory(p_user) is distinct from v_territory then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;

create policy surveys_select_by_audience
  on public.surveys for select
  to anon, authenticated
  using (public.survey_audience_allowed(id, auth.uid()));

create policy surveys_write_admin_or_coordinator
  on public.surveys for all
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

create policy survey_questions_select_by_audience
  on public.survey_questions for select
  to anon, authenticated
  using (public.survey_audience_allowed(survey_id, auth.uid()));

create policy survey_questions_write_admin_or_coordinator
  on public.survey_questions for all
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

-- survey_responses: insertar según audiencia (anon permitido si audience=public y encuesta
-- anónima); leer solo admin/coordinator (creador) o la propia respuesta si no es anónima.
create policy survey_responses_insert_by_audience
  on public.survey_responses for insert
  to anon, authenticated
  with check (
    public.survey_audience_allowed(survey_id, auth.uid())
    and exists (
      select 1 from public.surveys s
      where s.id = survey_id and now() between s.opens_at and s.closes_at
      and (
        (s.anonymous and user_id is null and anon_hash is not null)
        or (not s.anonymous and user_id = auth.uid())
      )
    )
  );

create policy survey_responses_select_own_or_admin
  on public.survey_responses for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_coordinator()
  );

commit;
