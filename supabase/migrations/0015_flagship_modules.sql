-- 0015_flagship_modules.sql
-- Los dos módulos bandera de vision-plataforma.md: "España en Directo" (econ_indicators)
-- y "El Vigía del BOE" (boe_items, watchdog_alerts).

begin;

create table public.econ_indicators (
  id             uuid primary key default extensions.gen_random_uuid(),
  indicator_key  text not null,     -- paro|deuda|vivienda|... (clave de la serie)
  value          numeric not null,
  unit           text not null,
  period         date not null,     -- a qué periodo corresponde el dato
  source         text not null,     -- IGAE|Banco de España|AEAT|...
  fetched_at     timestamptz not null default now()
);

create index econ_indicators_key_period_idx on public.econ_indicators(indicator_key, period desc);

create table public.boe_items (
  id              uuid primary key default extensions.gen_random_uuid(),
  boe_id          text unique not null,   -- identificador oficial del BOE
  title           text not null,
  section         text,
  published_date  date not null,
  url             text not null,
  summary         text,
  flags           jsonb,                  -- señales detectadas por el cerebro (ómnibus, etc.)
  ingested_at     timestamptz not null default now()
);

create index boe_items_published_date_idx on public.boe_items(published_date desc);

create table public.watchdog_alerts (
  id                     uuid primary key default extensions.gen_random_uuid(),
  boe_item_id            uuid null references public.boe_items(id),
  title                  text not null,
  description            text not null,
  evidence               jsonb,                  -- expediente: fuente, dato, método
  estimated_waste_cents  bigint null,
  status                 text not null default 'flagged'
                           check (status in ('flagged', 'verified', 'published', 'dismissed')),
  verified_by            uuid null references public.profiles(id),
  dossier_url            text null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.watchdog_alerts is 'Candidatos del Vigía. Regla innegociable (vision-plataforma.md): humano verifica y firma SIEMPRE antes de status=published.';

create trigger watchdog_alerts_set_updated_at
  before update on public.watchdog_alerts
  for each row execute function public.set_updated_at();

alter table public.econ_indicators enable row level security;
alter table public.boe_items enable row level security;
alter table public.watchdog_alerts enable row level security;

-- econ_indicators / boe_items: lectura pública (datos oficiales abiertos); escritura SOLO
-- service_role (ingesta n8n diaria).
create policy econ_indicators_select_public
  on public.econ_indicators for select
  to anon, authenticated
  using (true);

create policy boe_items_select_public
  on public.boe_items for select
  to anon, authenticated
  using (true);

-- watchdog_alerts: público SOLO ve status='published' (verificado y firmado); el pipeline
-- interno (flagged/verified/dismissed) es de equipo (moderator+). Escritura: admin gestiona
-- el ciclo de verificación; la ingesta de candidatos la hace service_role.
create policy watchdog_alerts_select_published_or_team
  on public.watchdog_alerts for select
  to anon, authenticated
  using (status = 'published' or public.is_moderator());

create policy watchdog_alerts_write_admin
  on public.watchdog_alerts for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
