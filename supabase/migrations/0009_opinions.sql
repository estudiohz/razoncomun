-- 0009_opinions.sql
-- Opiniones (chatbot Opina): recolección + clasificación interna.

begin;

create table public.opinions (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid null references public.profiles(id),   -- puede ser anónimo
  channel     text not null check (channel in ('web', 'discord', 'telegram')),
  raw_text    text not null,
  points      int[],                          -- puntos del manifiesto (multi)
  stance      text check (stance in ('favor', 'contra', 'favor_condiciones', 'duda')),
  kind        text check (kind in ('opinion', 'propuesta', 'dato', 'testimonio', 'pregunta', 'critica')),
  argument    text,                            -- resumen 1 frase (clustering)
  segment     text null,
  quality     smallint check (quality between 1 and 5),
  flags       text[],                          -- troll|agresivo|dato_dudoso|bulo
  created_at  timestamptz not null default now()
);

create index opinions_channel_idx on public.opinions(channel);
create index opinions_points_idx on public.opinions using gin(points);
create index opinions_flags_idx on public.opinions using gin(flags);

alter table public.opinions enable row level security;

-- Insertar: cualquiera (el bot recoge de web/discord/telegram, incluso sin sesión).
create policy opinions_insert_any
  on public.opinions for insert
  to anon, authenticated
  with check (true);

-- Leer crudo: solo moderator+ (equipo). No hay lectura pública ni "propia" (spec literal
-- de modelo-datos.md: "leer crudo: moderator+"; el remitente no puede releer su envío).
create policy opinions_select_moderator
  on public.opinions for select
  to authenticated
  using (public.is_moderator());

-- Moderación (clasificación manual, gestión de flags/derecho a réplica): moderator+.
create policy opinions_update_moderator
  on public.opinions for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());

commit;
