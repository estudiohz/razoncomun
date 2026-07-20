-- 0002_territories.sql
-- Territorio (comunidades autónomas / ciudades autónomas y provincias). Ver modelo-datos.md.
-- Las políticas de ESCRITURA (solo admin) se añaden en 0003_identity.sql, una vez existen
-- app_roles/user_app_roles y la función public.is_admin(). Aquí solo se habilita RLS y se
-- deja la lectura pública (el organigrama territorial es transparente por diseño).

begin;

create table public.territories (
  id        serial primary key,
  type      text not null check (type in ('community', 'province')),
  name      text not null,
  parent_id int null references public.territories(id) on delete restrict
);

comment on table public.territories is 'Comunidades/ciudades autónomas y provincias de España, con jerarquía provincia->comunidad.';
comment on column public.territories.parent_id is 'Solo aplica a type=province: FK a su comunidad autónoma.';

create index territories_parent_id_idx on public.territories(parent_id);
create index territories_type_idx on public.territories(type);

alter table public.territories enable row level security;

-- Lectura pública (anon incluido): el organigrama territorial es transparente.
create policy territories_select_public
  on public.territories
  for select
  to anon, authenticated
  using (true);

commit;
