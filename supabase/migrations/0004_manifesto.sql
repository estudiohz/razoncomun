-- 0004_manifesto.sql
-- Manifiesto: los 30 puntos fundacionales, núcleo estable y versionado.

begin;

create table public.manifesto_points (
  id          int primary key,             -- 1..30
  title       text not null,
  body        text not null,
  is_core     boolean not null default false,  -- núcleo inmutable (no votable)
  version     int not null default 1,
  updated_at  timestamptz not null default now()
);

comment on table public.manifesto_points is 'Los 30 puntos fundacionales del manifiesto. is_core=true => no editable por votación (aplicación); la escritura en BD sigue siendo solo admin.';

-- Historial de versiones (revision-seguridad.md, sugerencia 4: changelog público del ideario).
create table public.manifesto_point_versions (
  id           uuid primary key default extensions.gen_random_uuid(),
  point_id     int not null references public.manifesto_points(id) on delete cascade,
  version      int not null,
  title        text not null,
  body         text not null,
  changed_by   uuid null references public.profiles(id),
  vote_id      uuid null,  -- FK diferida a public.votes, se añade en 0006_votes_ballots.sql
  report_url   text null,  -- informe/justificación del cambio
  created_at   timestamptz not null default now()
);

comment on table public.manifesto_point_versions is 'Histórico completo de cambios de cada punto del manifiesto, enlazando la votación e informe que lo motivó.';

create index manifesto_point_versions_point_idx on public.manifesto_point_versions(point_id);

create trigger manifesto_points_set_updated_at
  before update on public.manifesto_points
  for each row execute function public.set_updated_at();

-- Snapshot automático de versión anterior antes de cada UPDATE.
create or replace function public.manifesto_points_snapshot()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.manifesto_point_versions (point_id, version, title, body, changed_by)
  values (old.id, old.version, old.title, old.body, auth.uid());
  return new;
end;
$$;

create trigger manifesto_points_snapshot_trg
  before update on public.manifesto_points
  for each row
  when (old.title is distinct from new.title or old.body is distinct from new.body)
  execute function public.manifesto_points_snapshot();

alter table public.manifesto_points enable row level security;
alter table public.manifesto_point_versions enable row level security;

-- Lectura pública, escritura solo admin (is_core no editable por votación: se aplica en capa app).
create policy manifesto_points_select_public
  on public.manifesto_points for select
  to anon, authenticated
  using (true);

create policy manifesto_points_write_admin
  on public.manifesto_points for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy manifesto_point_versions_select_public
  on public.manifesto_point_versions for select
  to anon, authenticated
  using (true);

-- El historial se escribe únicamente vía el trigger (security definer implícito del owner);
-- no se permite escritura directa desde authenticated/anon (ni siquiera admin: es un log).
commit;
