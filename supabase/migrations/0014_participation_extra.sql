-- 0014_participation_extra.sql
-- Tablas adicionales pedidas en vision-plataforma.md ("Implicaciones técnicas"):
-- follows, notifications (+preferencias), referrals, decisions (memoria institucional),
-- commitments (semáforo de cumplimiento), processes (procesos con fases), meetings
-- (+ inscripciones), ai_evals (suite de sesgo), donations (separada de cuotas, LO 8/2007).

begin;

-- ============================================================================
-- follows / notifications
-- ============================================================================

create table public.follows (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  target_type  text not null check (target_type in ('topic', 'manifesto_point', 'territory', 'proposal')),
  target_id    text not null,   -- polimórfico: id de departamento(text)/manifesto_points(int)/territories(int)/proposals(uuid)
  created_at   timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index follows_target_idx on public.follows(target_type, target_id);

create table public.notification_preferences (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  email_enabled     boolean not null default true,
  push_enabled      boolean not null default true,
  digest_frequency  text not null default 'weekly' check (digest_frequency in ('immediate', 'weekly', 'never')),
  updated_at        timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.notifications (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text null,
  channel     text not null default 'in_app' check (channel in ('email', 'push', 'in_app')),
  read_at     timestamptz null,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, read_at);

-- ============================================================================
-- referrals
-- ============================================================================

create table public.referrals (
  id            uuid primary key default extensions.gen_random_uuid(),
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  referred_id   uuid null references public.profiles(id),
  code          text unique not null,
  created_at    timestamptz not null default now(),
  converted_at  timestamptz null
);

create index referrals_referrer_idx on public.referrals(referrer_id);

-- ============================================================================
-- decisions (memoria institucional del cerebro)
-- ============================================================================

create table public.decisions (
  id                        uuid primary key default extensions.gen_random_uuid(),
  title                     text not null,
  summary                   text not null,
  evidence_urls             text[] not null default '{}',
  alternatives_considered   text,
  vote_id                   uuid null references public.votes(id),
  decided_at                timestamptz not null,
  created_at                timestamptz not null default now()
);

-- ============================================================================
-- commitments (semáforo de cumplimiento, Decidim)
-- ============================================================================

create table public.commitments (
  id                   uuid primary key default extensions.gen_random_uuid(),
  title                text not null,
  description          text,
  status               text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  evidence_url         text null,
  manifesto_point_id   int null references public.manifesto_points(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger commitments_set_updated_at
  before update on public.commitments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- processes (procesos participativos con fases, Decidim/vTaiwan)
-- ============================================================================

create table public.processes (
  id           uuid primary key default extensions.gen_random_uuid(),
  title        text not null,
  description  text,
  phase        text not null default 'diagnosis' check (phase in ('diagnosis', 'proposals', 'deliberation', 'voting', 'closed')),
  department   text,
  opens_at     timestamptz,
  closes_at    timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================================
-- meetings (encuentros con inscripción + acta)
-- ============================================================================

create table public.meetings (
  id            uuid primary key default extensions.gen_random_uuid(),
  title         text not null,
  description   text,
  territory_id  int null references public.territories(id),
  starts_at     timestamptz not null,
  location      text,
  capacity      int null,
  minutes_url   text null,   -- acta (transcripción IA revisada)
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table public.meeting_registrations (
  meeting_id     uuid not null references public.meetings(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  registered_at  timestamptz not null default now(),
  attended       boolean not null default false,
  primary key (meeting_id, user_id)
);

-- ============================================================================
-- ai_evals (suite de neutralidad/sesgo del cerebro, Pilar 4)
-- ============================================================================

create table public.ai_evals (
  id                  uuid primary key default extensions.gen_random_uuid(),
  run_at              timestamptz not null default now(),
  prompt_version      text not null,
  test_case           text not null,
  variant_a_label     text not null,
  variant_a_result    jsonb,
  variant_b_label     text not null,
  variant_b_result    jsonb,
  passed              boolean not null,
  notes               text
);

-- ============================================================================
-- donations (separada de cuotas, LO 8/2007: identificación obligatoria, no anónimas)
-- ============================================================================

create table public.donations (
  id                 uuid primary key default extensions.gen_random_uuid(),
  donor_name         text not null,
  donor_id_document  text not null,   -- DNI/NIE del donante (dato muy sensible, LO 8/2007 prohíbe donaciones anónimas)
  amount_cents       int not null,
  donated_at         timestamptz not null default now(),
  stripe_payment_id  text null,
  status             text not null default 'completed' check (status in ('completed', 'refunded'))
);

comment on table public.donations is 'LO 8/2007: donaciones ≠ cuotas, prohibidas las anónimas, solo personas físicas. Tabla lista pero módulo inactivo (vision-plataforma.md). donor_id_document es dato muy sensible: SIN lectura pública ni agregada en esta migración.';

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.follows enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.referrals enable row level security;
alter table public.decisions enable row level security;
alter table public.commitments enable row level security;
alter table public.processes enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_registrations enable row level security;
alter table public.ai_evals enable row level security;
alter table public.donations enable row level security;

-- follows: 100% propio.
create policy follows_all_own
  on public.follows for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notification_preferences: 100% propio (upsert).
create policy notification_preferences_all_own
  on public.notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- notifications: lectura/actualización (marcar leída) propia; inserción SOLO service_role
-- (las genera el backend/n8n en eventos de follows).
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- referrals: propio (el referrer ve y crea sus propios enlaces); converted_at lo actualiza
-- el servicio (webhook de alta), sin policy de UPDATE para authenticated.
create policy referrals_select_own
  on public.referrals for select
  to authenticated
  using (referrer_id = auth.uid());

create policy referrals_insert_own
  on public.referrals for insert
  to authenticated
  with check (referrer_id = auth.uid());

-- decisions / commitments / processes: memoria institucional y semáforo, públicos en
-- lectura (transparencia radical); escritura solo admin.
create policy decisions_select_public
  on public.decisions for select
  to anon, authenticated
  using (true);

create policy decisions_write_admin
  on public.decisions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy commitments_select_public
  on public.commitments for select
  to anon, authenticated
  using (true);

create policy commitments_write_admin
  on public.commitments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy processes_select_public
  on public.processes for select
  to anon, authenticated
  using (true);

create policy processes_write_admin_or_coordinator
  on public.processes for all
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

-- meetings: públicas en lectura; gestión admin/coordinator.
create policy meetings_select_public
  on public.meetings for select
  to anon, authenticated
  using (true);

create policy meetings_write_admin_or_coordinator
  on public.meetings for all
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

-- meeting_registrations: propia + admin/coordinator (organizador); inscribirse es propio.
create policy meeting_registrations_select_own_or_org
  on public.meeting_registrations for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_coordinator());

create policy meeting_registrations_insert_own
  on public.meeting_registrations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy meeting_registrations_delete_own
  on public.meeting_registrations for delete
  to authenticated
  using (user_id = auth.uid());

create policy meeting_registrations_update_org
  on public.meeting_registrations for update
  to authenticated
  using (public.is_admin() or public.is_coordinator())
  with check (public.is_admin() or public.is_coordinator());

-- ai_evals: resultados públicos (transparencia-ia), sin escritura de cliente (solo service_role).
create policy ai_evals_select_public
  on public.ai_evals for select
  to anon, authenticated
  using (true);

-- donations: dato muy sensible (DNI del donante). SOLO admin/treasurer, nunca público,
-- sin política de INSERT para clientes (solo service_role vía procesador de pago).
create policy donations_select_finance
  on public.donations for select
  to authenticated
  using (public.is_treasurer() or public.is_admin());

commit;
