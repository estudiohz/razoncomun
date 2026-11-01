-- 0074 · Auditoría — copias de respaldo del origen y de las pruebas.
--
-- Sergio (01-11-2026): además del enlace al origen, hay que guardar una copia
-- por si el origen desaparece, asociada a la auditoría. Y la verificación
-- exige guardar la prueba real (M2: copia sellada con hash y fecha).
--
-- Cada copia es un archivo en el bucket PRIVADO `vigia-pruebas` (nunca
-- público; retención ≥ 4 años, M11) más su fila aquí con la huella sha256.
--   · tipo 'origen': el reel (vídeo), artículo o web del que nace el caso.
--   · tipo 'prueba': el registro o la página oficial (BDNS, BOE…); además
--     rellena `watchdog_evidence.snapshot_*`, que es lo que exige el trigger
--     de publicación de la 0069.

begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vigia-pruebas', 'vigia-pruebas', false, 104857600)  -- 100 MB (vídeos)
on conflict (id) do nothing;

create table public.watchdog_copias (
  id            uuid primary key default extensions.gen_random_uuid(),
  alert_id      uuid not null references public.watchdog_alerts(id) on delete cascade,
  evidence_id   uuid references public.watchdog_evidence(id) on delete set null,
  tipo          text not null check (tipo in ('origen', 'prueba')),
  metodo        text not null check (metodo in ('html', 'json', 'pdf', 'video', 'imagen', 'otro')),
  url           text not null check (url ~* '^https?://'),
  storage_path  text not null,
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime          text,
  bytes         bigint check (bytes >= 0),
  capturada_at  timestamptz not null default now(),
  notas         text,
  created_by    uuid references public.profiles(id),
  unique (alert_id, sha256)
);

comment on table public.watchdog_copias is
  'Copias de respaldo del origen y de las pruebas de cada caso, con sha256 y fecha (0074). El archivo vive en el bucket privado vigia-pruebas.';

create index watchdog_copias_alert_idx on public.watchdog_copias (alert_id, capturada_at desc);

alter table public.watchdog_copias enable row level security;

-- Solo el equipo de auditoría las ve. Se escriben desde el servidor
-- (service_role) al descargar; un auditor puede anotar o borrar.
create policy watchdog_copias_select on public.watchdog_copias
  for select to authenticated using (public.is_auditor());

create policy watchdog_copias_update on public.watchdog_copias
  for update to authenticated using (public.is_auditor()) with check (public.is_auditor());

create policy watchdog_copias_delete on public.watchdog_copias
  for delete to authenticated using (public.is_admin());

grant select, update (notas), delete on public.watchdog_copias to authenticated;

commit;
