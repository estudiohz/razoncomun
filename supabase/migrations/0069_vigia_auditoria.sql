-- 0069 · Auditoría en tiempo real — casos, pruebas y rol auditor (fase F1).
--
-- Segundo trozo del esquema de docs/auditoria-tiempo-real/04-arquitectura.md §3
-- (el primero, `watchdog_sources`, es la 0068). Extiende la 0015 en vez de
-- reemplazarla (D-A01):
--   · rol de app `auditor` + `is_auditor()`. Por decisión de Sergio (D-A06,
--     01-11-2026) auditan los `auditor`, los moderadores (cargo orgánico) y
--     los admin. Los editores NO: revisar gasto público no es editar contenido.
--   · `watchdog_accounts`: cuentas vigiladas (D-A16), seed de
--     @elrastrodeldinero INACTIVA hasta que haya acuerdo (D-A03).
--   · `watchdog_alerts` pasa a ser el "caso": columnas de la ficha, estados
--     nuevos e invariantes por trigger (no solo UI).
--   · `watchdog_evidence`: las pruebas oficiales de cada caso.
--   · `placsp_contracts`: índice local de PLACSP para el contraste (T1.2).
--   · `watchdog_totals()`: el contador público (D-A09).
-- Rectificaciones y versiones (`watchdog_corrections`,
-- `watchdog_alert_versions`) llegan con la sección pública, en F2.

begin;

-- ── Rol auditor ─────────────────────────────────────────────────────────────

insert into public.app_roles (key, label)
values ('auditor', 'Auditor')
on conflict (key) do nothing;

create or replace function public.is_auditor(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  -- is_moderator() ya incluye a los admin.
  select public.has_app_role(p_user, 'auditor') or public.is_moderator(p_user);
$$;

comment on function public.is_auditor(uuid) is
  'Puede revisar y firmar casos de auditoría: rol auditor, cargo moderator o admin (D-A06).';

-- ── Cuentas vigiladas ───────────────────────────────────────────────────────

create table public.watchdog_accounts (
  id                    uuid primary key default extensions.gen_random_uuid(),
  platform              text not null default 'instagram'
                          check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'otro')),
  handle                text not null,
  display_name          text,
  active                boolean not null default false,  -- solo se vigila si está activa
  poll_minutes          int not null default 15 check (poll_minutes between 5 and 1440),
  agreement             text not null default 'none'
                          check (agreement in ('none', 'requested', 'granted', 'declined')),
  agreement_notes       text,
  telegram_chat_id      text,
  last_seen_external_id text,                             -- cursor de detección
  last_polled_at        timestamptz,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  unique (platform, handle)
);

comment on table public.watchdog_accounts is
  'Cuentas cuyos reels se vigilan (D-A16). Inactivas por defecto: sin acuerdo no se sondea (D-A03).';

insert into public.watchdog_accounts (platform, handle, display_name, active, agreement)
values ('instagram', 'elrastrodeldinero', 'El rastro del dinero', false, 'none')
on conflict (platform, handle) do nothing;

-- ── Fuentes: enlace con la cuenta ───────────────────────────────────────────

alter table public.watchdog_sources
  add column account_id uuid references public.watchdog_accounts(id),
  add column created_by uuid references public.profiles(id);  -- null si llegó por el bot

-- ── Casos (watchdog_alerts de la 0015) ──────────────────────────────────────

alter table public.watchdog_alerts drop constraint if exists watchdog_alerts_status_check;

alter table public.watchdog_alerts
  add constraint watchdog_alerts_status_check
    check (status in ('flagged', 'analyzed', 'pending_reply', 'verified', 'published', 'dismissed')),
  add column source_id                uuid references public.watchdog_sources(id) on delete set null,
  add column slug                     text unique,
  add column organismo                text,
  add column organismo_nivel          text check (organismo_nivel in ('estatal', 'autonomico', 'local', 'otro')),
  add column adjudicatario            text,
  add column adjudicatario_nif        text,
  add column es_persona_fisica        boolean not null default false,
  add column categoria                text
    check (categoria in ('consultoria', 'eventos', 'publicidad', 'obras', 'suministros', 'subvencion', 'otro')),
  add column importe_denunciado_cents bigint check (importe_denunciado_cents >= 0),
  add column importe_oficial_cents    bigint check (importe_oficial_cents >= 0),
  add column fecha_adjudicacion       date,
  add column verificacion             text check (verificacion in ('coincide', 'parcial', 'no_encontrado', 'desmentido')),
  add column hechos_html              text,
  add column valoracion_html          text,
  add column ai_extraction            jsonb,
  add column ai_model                 text,
  add column replica_solicitada_at    timestamptz,
  add column replica_texto            text,
  add column dismiss_reason           text,
  add column verified_at              timestamptz,
  add column published_at             timestamptz,
  add column rectificado_at           timestamptz,
  add column rectificacion_nota       text,
  add column created_by               uuid references public.profiles(id),
  add column counts_in_total          boolean generated always as (
    status = 'published' and rectificado_at is null and verificacion in ('coincide', 'parcial')
  ) stored;

create index watchdog_alerts_status_idx on public.watchdog_alerts (status, created_at desc);
create index watchdog_alerts_source_idx on public.watchdog_alerts (source_id);

-- ── Pruebas ─────────────────────────────────────────────────────────────────

create table public.watchdog_evidence (
  id              uuid primary key default extensions.gen_random_uuid(),
  alert_id        uuid not null references public.watchdog_alerts(id) on delete cascade,
  source_kind     text not null check (source_kind in ('placsp', 'boe', 'bdns', 'borme', 'autonomica', 'otro')),
  expediente      text,
  organo          text,
  adjudicatario   text,
  nif             text,
  importe_cents   bigint check (importe_cents >= 0),
  fecha           date,
  url             text not null check (url ~* '^https?://'),
  snapshot_path   text,            -- bucket privado 'vigia-pruebas' (retención ≥ 4 años, M11)
  snapshot_sha256 text check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_at     timestamptz,
  raw             jsonb,
  match_score     numeric(4,3) check (match_score between 0 and 1),
  matched_by      text not null default 'manual' check (matched_by in ('auto', 'manual')),
  selected        boolean not null default false,
  notes           text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create index watchdog_evidence_alert_idx on public.watchdog_evidence (alert_id);
-- Una sola prueba principal por caso.
create unique index watchdog_evidence_one_selected
  on public.watchdog_evidence (alert_id) where selected;

-- ── Invariantes del caso (por trigger: la UI no es la única puerta) ─────────

create or replace function public.watchdog_alerts_invariantes()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status in ('verified', 'published') then
    if new.verified_by is null or new.verified_at is null then
      raise exception 'Un caso % necesita revisor y fecha de verificación', new.status;
    end if;
    if coalesce(btrim(new.hechos_html), '') = '' then
      raise exception 'Un caso % necesita el bloque de hechos verificados', new.status;
    end if;
    if not exists (
      select 1 from public.watchdog_evidence e
      where e.alert_id = new.id and e.selected
    ) then
      raise exception 'Un caso % necesita una prueba principal seleccionada', new.status;
    end if;
  end if;

  if new.status = 'published' then
    if new.published_at is null then
      raise exception 'Un caso publicado necesita fecha de publicación';
    end if;
    if not exists (
      select 1 from public.watchdog_evidence e
      where e.alert_id = new.id
        and e.source_kind in ('placsp', 'boe', 'bdns', 'autonomica')
        and e.snapshot_sha256 is not null
    ) then
      raise exception 'Un caso publicado necesita una prueba oficial con copia guardada (sha256)';
    end if;
  end if;

  if new.status = 'dismissed' and coalesce(btrim(new.dismiss_reason), '') = '' then
    raise exception 'Descartar un caso exige motivo';
  end if;

  return new;
end;
$$;

create trigger watchdog_alerts_invariantes
  before insert or update on public.watchdog_alerts
  for each row execute function public.watchdog_alerts_invariantes();

-- ── Índice local de PLACSP ──────────────────────────────────────────────────

create table public.placsp_contracts (
  id                 uuid primary key default extensions.gen_random_uuid(),
  entry_id           text unique not null,
  feed               text not null check (feed in ('alojados', 'menores', 'agregados')),
  expediente         text,
  expediente_norm    text,
  organo             text,
  organo_nivel       text,
  adjudicatario      text,
  nif                text,
  importe_cents      bigint,
  fecha_adjudicacion date,
  tipo_contrato      text,
  procedimiento      text,
  url                text,
  updated_in_feed    timestamptz,
  raw                jsonb,
  fetched_at         timestamptz not null default now()
);

create index placsp_contracts_expediente_idx on public.placsp_contracts (expediente_norm);
create index placsp_contracts_nif_idx on public.placsp_contracts (nif);
create index placsp_contracts_organo_trgm on public.placsp_contracts using gin (organo gin_trgm_ops);
create index placsp_contracts_adjudicatario_trgm on public.placsp_contracts using gin (adjudicatario gin_trgm_ops);
create index boe_items_title_trgm on public.boe_items using gin (title gin_trgm_ops);

-- ── Contador público ────────────────────────────────────────────────────────

create or replace function public.watchdog_totals()
returns table (casos int, importe_cents bigint, actualizado timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*)::int, coalesce(sum(importe_oficial_cents), 0)::bigint, max(published_at)
  from public.watchdog_alerts
  where counts_in_total and published_at <= now();
$$;

grant execute on function public.watchdog_totals() to anon, authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────

-- Casos: el público ve solo lo publicado y ya en fecha; el equipo de
-- auditoría lo ve y lo trabaja todo. Borrar: solo admin.
drop policy if exists watchdog_alerts_select_published_or_team on public.watchdog_alerts;
drop policy if exists watchdog_alerts_write_admin on public.watchdog_alerts;

create policy watchdog_alerts_select on public.watchdog_alerts
  for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or public.is_auditor());

create policy watchdog_alerts_insert on public.watchdog_alerts
  for insert to authenticated
  with check (public.is_auditor());

create policy watchdog_alerts_update on public.watchdog_alerts
  for update to authenticated
  using (public.is_auditor())
  with check (public.is_auditor());

create policy watchdog_alerts_delete on public.watchdog_alerts
  for delete to authenticated
  using (public.is_admin());

-- Bandeja (0068): pasa de editores a auditores.
drop policy if exists watchdog_sources_select on public.watchdog_sources;
drop policy if exists watchdog_sources_update on public.watchdog_sources;

create policy watchdog_sources_select on public.watchdog_sources
  for select to authenticated using (public.is_auditor());

create policy watchdog_sources_update on public.watchdog_sources
  for update to authenticated
  using (public.is_auditor()) with check (public.is_auditor());

-- Alta manual de un reel desde el admin (sin pasar por Telegram).
create policy watchdog_sources_insert_manual on public.watchdog_sources
  for insert to authenticated
  with check (public.is_auditor() and kind in ('manual_url', 'manual_form'));

grant insert (kind, permalink, message_text, created_by) on public.watchdog_sources to authenticated;

-- Pruebas: públicas solo la principal de un caso publicado.
alter table public.watchdog_evidence enable row level security;

create policy watchdog_evidence_select on public.watchdog_evidence
  for select to anon, authenticated
  using (
    public.is_auditor()
    or (selected and exists (
      select 1 from public.watchdog_alerts a
      where a.id = alert_id and a.status = 'published' and a.published_at <= now()
    ))
  );

create policy watchdog_evidence_write on public.watchdog_evidence
  for all to authenticated
  using (public.is_auditor()) with check (public.is_auditor());

grant select on public.watchdog_evidence to anon;
grant select, insert, update, delete on public.watchdog_evidence to authenticated;

-- Cuentas: el equipo las ve; las gestiona un admin.
alter table public.watchdog_accounts enable row level security;

create policy watchdog_accounts_select on public.watchdog_accounts
  for select to authenticated using (public.is_auditor());

create policy watchdog_accounts_write on public.watchdog_accounts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.watchdog_accounts to authenticated;

-- PLACSP: datos oficiales abiertos, lectura pública; escribe la ingesta.
alter table public.placsp_contracts enable row level security;

create policy placsp_contracts_select on public.placsp_contracts
  for select to anon, authenticated using (true);

grant select on public.placsp_contracts to anon, authenticated;

commit;
