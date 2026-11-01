-- 0075 · Auditoría — sección pública (fase F2): versiones y rectificaciones.
--
-- docs/auditoria-tiempo-real/04-arquitectura.md §3.5 y doc 03 (M1, M7):
--   · `watchdog_alert_versions`: copia de la ficha en cada publicación y en
--     cada rectificación. Alimenta el historial público (M7).
--   · `watchdog_corrections`: solicitudes de rectificación u oposición desde
--     el formulario público. Se insertan desde el servidor (service_role,
--     con captcha y límite); solo el equipo las lee.
--   · `watchdog_alerts.firmado_por`: nombre del auditor que firma, copiado al
--     publicar (M1 exige que se vea), para no abrir `profiles` al público.

begin;

alter table public.watchdog_alerts
  add column firmado_por text;

comment on column public.watchdog_alerts.firmado_por is
  'Nombre público del auditor que verificó el caso, fijado al publicar (M1, 0075).';

create table public.watchdog_alert_versions (
  id          uuid primary key default extensions.gen_random_uuid(),
  alert_id    uuid not null references public.watchdog_alerts(id) on delete cascade,
  version     int not null check (version >= 1),
  snapshot    jsonb not null,
  reason      text not null,
  changed_by  uuid references public.profiles(id),
  changed_at  timestamptz not null default now(),
  unique (alert_id, version)
);

comment on table public.watchdog_alert_versions is
  'Historial público de cada ficha: una versión por publicación o rectificación (M7, 0075).';

alter table public.watchdog_alert_versions enable row level security;

create policy watchdog_alert_versions_select on public.watchdog_alert_versions
  for select to anon, authenticated
  using (
    public.is_auditor()
    or exists (select 1 from public.watchdog_alerts a
               where a.id = alert_id and a.status = 'published' and a.published_at <= now())
  );

create policy watchdog_alert_versions_insert on public.watchdog_alert_versions
  for insert to authenticated with check (public.is_auditor());

grant select on public.watchdog_alert_versions to anon;
grant select, insert on public.watchdog_alert_versions to authenticated;

-- El campo `changed_by` es un id interno: al público solo le hace falta la
-- fecha, el motivo y el contenido. Se oculta con privilegios de columna.
revoke select on public.watchdog_alert_versions from anon;
grant select (id, alert_id, version, snapshot, reason, changed_at) on public.watchdog_alert_versions to anon;

create table public.watchdog_corrections (
  id               uuid primary key default extensions.gen_random_uuid(),
  alert_id         uuid not null references public.watchdog_alerts(id) on delete cascade,
  requester_name   text not null,
  requester_email  text not null check (requester_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  requester_role   text not null check (requester_role in ('afectado', 'representante', 'otro')),
  request_text     text not null,
  received_at      timestamptz not null default now(),
  resolved_at      timestamptz,
  resolution       text check (resolution in ('aceptada', 'parcial', 'rechazada')),
  public_note      text,
  handled_by       uuid references public.profiles(id)
);

comment on table public.watchdog_corrections is
  'Solicitudes de rectificación u oposición de una ficha publicada (M7, LO 2/1984). Respuesta en 3 días (0075).';

create index watchdog_corrections_alert_idx on public.watchdog_corrections (alert_id, received_at desc);
create index watchdog_corrections_pendientes_idx on public.watchdog_corrections (received_at) where resolved_at is null;

alter table public.watchdog_corrections enable row level security;

create policy watchdog_corrections_select on public.watchdog_corrections
  for select to authenticated using (public.is_auditor());

create policy watchdog_corrections_update on public.watchdog_corrections
  for update to authenticated using (public.is_auditor()) with check (public.is_auditor());

grant select, update (resolved_at, resolution, public_note, handled_by) on public.watchdog_corrections to authenticated;

commit;
