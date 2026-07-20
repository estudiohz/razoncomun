-- 0008_budget_simulator.sql
-- Simulador del Presupuesto ("Tú decides el presupuesto"): ministries, budget_scenarios.

begin;

create table public.ministries (
  id                    serial primary key,
  name                  text not null,
  current_budget_cents  bigint not null,   -- PGE real, sync n8n
  note                  text
);

create table public.budget_scenarios (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid null references public.profiles(id),   -- NULL = anónimo
  anon_hash   text null,                                    -- hash anti-duplicado si anónimo
  allocation  jsonb not null,                                -- {ministry_id: cents|pct}
  created_at  timestamptz not null default now(),
  constraint budget_scenarios_identity_chk check (
    (user_id is not null and anon_hash is null) or (user_id is null and anon_hash is not null)
  )
);

create index budget_scenarios_user_idx on public.budget_scenarios(user_id);

alter table public.ministries enable row level security;
alter table public.budget_scenarios enable row level security;

-- ministries: lectura pública; escritura SOLO service_role (sync n8n desde PGE real).
create policy ministries_select_public
  on public.ministries for select
  to anon, authenticated
  using (true);

-- budget_scenarios: cualquiera (incluido anon) puede enviar su reparto; lectura propia o admin.
create policy budget_scenarios_insert_any
  on public.budget_scenarios for insert
  to anon, authenticated
  with check (
    (user_id is null and anon_hash is not null)
    or (user_id = auth.uid())
  );

create policy budget_scenarios_select_own_or_admin
  on public.budget_scenarios for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- "El Presupuesto de la Gente": mediana agregada por ministerio, separando afiliados de
-- público general (member = existe fila members activa para ese user_id).
create view public.budget_scenario_medians
  with (security_invoker = false) as
  select
    m.key::int as ministry_id,
    (exists (
      select 1 from public.members mem
      where mem.user_id = bs.user_id and mem.status = 'active'
    )) as is_member,
    percentile_cont(0.5) within group (order by (m.value)::numeric) as median_value,
    count(*) as scenario_count
  from public.budget_scenarios bs,
       jsonb_each_text(bs.allocation) as m(key, value)
  group by 1, 2;

comment on view public.budget_scenario_medians is 'Agregado público mensual "El Presupuesto de la Gente": mediana por ministerio, separando member/público. Nunca expone allocation individual.';

grant select on public.budget_scenario_medians to anon, authenticated;

commit;
