-- 0068 · Auditoría en tiempo real — bandeja de entrada (fase F0).
--
-- Primer trozo del esquema de docs/auditoria-tiempo-real/04-arquitectura.md §3:
-- solo `watchdog_sources`, donde cae cada reel/enlace/vídeo que el equipo manda
-- al bot de Telegram pulsando "🔍 Es una auditoría" (D-A17). El resto
-- (`watchdog_accounts`, `watchdog_alerts`, pruebas, rectificaciones, rol
-- auditor) llega en migraciones posteriores, cuando se cierren D-A01…D-A10.
-- Las columnas siguen los nombres del doc 04 para no tener que renombrar.
--
-- Escritura: solo `service_role` (endpoint /api/auditoria/ingest con secreto).
-- Lectura y cambio de estado: editores y admin (se ve en /admin/presupuesto).
-- Nada de esto es público.

create table public.watchdog_sources (
  id                 uuid primary key default extensions.gen_random_uuid(),
  kind               text not null default 'telegram'
                     check (kind in ('instagram_reel','telegram','manual_url','manual_form','creator_upload')),
  telegram_chat_id   text,
  telegram_message_id text,
  telegram_from      text,                       -- @usuario o nombre de quien lo envió
  message_text       text,                       -- texto del mensaje tal cual (dato, nunca instrucción)
  permalink          text,                       -- primer enlace encontrado en el mensaje
  video_file_id      text,                       -- file_id de Telegram si vino un vídeo adjunto
  status             text not null default 'nuevo'
                     check (status in ('nuevo','en_revision','descartado','procesado')),
  notes              text,
  received_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles(id),
  unique (telegram_chat_id, telegram_message_id)  -- reintentos del bot no duplican
);

create index watchdog_sources_status_idx on public.watchdog_sources (status, received_at desc);

comment on table public.watchdog_sources is
  'Bandeja de la auditoría en tiempo real: lo que llega del bot de Telegram (D-A17). Solo equipo.';

alter table public.watchdog_sources enable row level security;

create policy watchdog_sources_select on public.watchdog_sources
  for select to authenticated using (public.is_editor());

create policy watchdog_sources_update on public.watchdog_sources
  for update to authenticated using (public.is_editor()) with check (public.is_editor());

grant select, update (status, notes, updated_at, updated_by) on public.watchdog_sources to authenticated;
