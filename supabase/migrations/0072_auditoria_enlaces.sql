-- 0072 · Auditoría — enlaces con propuestas, simulador y transparencia.
--
-- Sergio (01-11-2026):
--   · Si una auditoría se convierte en propuesta, la propuesta guarda su
--     origen (`proposals.source_alert_id`).
--   · El Simulador del País es central: cada caso se enlaza a las partidas
--     donde cae ese gasto (`watchdog_alert_partidas`).
--   · Solicitudes de acceso a la información (Ley 19/2013) con seguimiento
--     dentro del propio caso (`watchdog_transparency_requests`). El Portal de
--     Transparencia no tiene API y exige Cl@ve, así que la solicitud se
--     redacta aquí, se presenta a mano y aquí se sigue el plazo.

begin;

-- ── Caso → propuesta ────────────────────────────────────────────────────────

alter table public.proposals
  add column source_alert_id uuid null references public.watchdog_alerts(id) on delete set null;

comment on column public.proposals.source_alert_id is
  'Caso de auditoría del que nace la propuesta (0072). La ficha pública lo enseña solo si el caso está publicado.';

create index proposals_source_alert_idx on public.proposals (source_alert_id) where source_alert_id is not null;

-- ── Caso ↔ partidas del simulador ───────────────────────────────────────────

create table public.watchdog_alert_partidas (
  alert_id    uuid not null references public.watchdog_alerts(id) on delete cascade,
  partida_id  uuid not null references public.sim_partidas(id) on delete cascade,
  nota        text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (alert_id, partida_id)
);

comment on table public.watchdog_alert_partidas is
  'En qué partidas del Simulador del País cae el gasto de cada caso de auditoría (0072).';

create index watchdog_alert_partidas_partida_idx on public.watchdog_alert_partidas (partida_id);

alter table public.watchdog_alert_partidas enable row level security;

-- Público: solo el enlace entre un caso publicado y una partida publicada.
create policy watchdog_alert_partidas_select on public.watchdog_alert_partidas
  for select to anon, authenticated
  using (
    public.is_auditor()
    or (
      exists (select 1 from public.watchdog_alerts a
              where a.id = alert_id and a.status = 'published' and a.published_at <= now())
      and exists (select 1 from public.sim_partidas p where p.id = partida_id and p.publicado)
    )
  );

create policy watchdog_alert_partidas_write on public.watchdog_alert_partidas
  for all to authenticated
  using (public.is_auditor()) with check (public.is_auditor());

grant select on public.watchdog_alert_partidas to anon;
grant select, insert, update, delete on public.watchdog_alert_partidas to authenticated;

-- ── Solicitudes de acceso a la información ──────────────────────────────────

create table public.watchdog_transparency_requests (
  id                  uuid primary key default extensions.gen_random_uuid(),
  alert_id            uuid not null references public.watchdog_alerts(id) on delete cascade,
  organismo           text not null,
  asunto              text not null,
  texto               text not null,
  estado              text not null default 'borrador'
                        check (estado in ('borrador', 'presentada', 'ampliada', 'respondida', 'denegada',
                                          'silencio', 'reclamada', 'cerrada')),
  presentada_at       date,
  numero_registro     text,            -- el que da el Portal al presentarla
  ampliada_at         date,            -- art. 20.1: el plazo puede ampliarse un mes más
  respuesta_at        date,
  respuesta_texto     text,
  respuesta_url       text check (respuesta_url is null or respuesta_url ~* '^https?://'),
  reclamacion_at      date,            -- art. 24: reclamación ante el Consejo de Transparencia
  reclamacion_numero  text,
  notas               text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint watchdog_transparency_presentada_chk
    check (estado = 'borrador' or presentada_at is not null)
);

comment on table public.watchdog_transparency_requests is
  'Solicitudes de acceso a la información pública (Ley 19/2013) hechas a raíz de un caso, con su plazo y respuesta (0072).';

create index watchdog_transparency_alert_idx on public.watchdog_transparency_requests (alert_id);

create trigger watchdog_transparency_set_updated_at
  before update on public.watchdog_transparency_requests
  for each row execute function public.set_updated_at();

alter table public.watchdog_transparency_requests enable row level security;

create policy watchdog_transparency_all on public.watchdog_transparency_requests
  for all to authenticated
  using (public.is_auditor()) with check (public.is_auditor());

grant select, insert, update, delete on public.watchdog_transparency_requests to authenticated;

commit;
