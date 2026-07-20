-- 0003_identity.sql
-- Identidad y afiliación: profiles (espejo 1:1 de auth.users), members (espejo Stripe/SEPA),
-- positions (cargos orgánicos), app_roles/user_app_roles (roles funcionales).
-- Define también las funciones helper de autorización (SECURITY DEFINER) que usa el resto
-- del esquema para no depender de RLS recursiva ni del claim `level` del JWT (C2).

begin;

-- ============================================================================
-- TABLAS
-- ============================================================================

create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  display_name          text,
  level                 text not null default 'registered'
                          check (level in ('registered', 'member', 'verified')),
  origin_province_id    int null references public.territories(id),
  newsletter_opt_in     boolean not null default false,
  newsletter_opt_in_at  timestamptz null,      -- prueba de consentimiento (revision-seguridad.md, sugerencia 5)
  privacy_consent_at    timestamptz null,      -- consentimiento explícito Art. 9 RGPD (alta)
  member_since          timestamptz null,      -- regla antigaming (3 meses), ancla = members.started_at
  identity_verified_at  timestamptz null,      -- Stripe Identity OK
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is 'Extiende auth.users 1:1. El nivel (level) es uno de los 3 ejes ortogonales de permisos.';
comment on column public.profiles.level is 'registered|member|verified. NO es el único eje: ver positions (cargo) y members (afiliación activa).';

create index profiles_origin_province_idx on public.profiles(origin_province_id);

create table public.members (
  id                      uuid primary key default extensions.gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  status                  text not null check (status in ('active', 'past_due', 'canceled')),
  billing_period          text check (billing_period in ('monthly', 'annual')),
  amount_cents            int,
  payment_method          text not null default 'sepa_debit',   -- DECISIÓN: cuota por SEPA, no tarjeta
  sepa_mandate_id         text null,
  started_at              timestamptz,          -- ancla de member_since
  canceled_at             timestamptz null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.members is 'Espejo de Stripe (webhooks, rc-07-afiliacion). Escritura SOLO service_role.';

create index members_user_id_idx on public.members(user_id);
create index members_status_idx on public.members(status);
create unique index members_stripe_subscription_uidx on public.members(stripe_subscription_id) where stripe_subscription_id is not null;

create table public.positions (
  id            uuid primary key default extensions.gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text not null check (role in ('president', 'treasurer', 'vocal', 'council_member', 'coordinator', 'moderator')),
  scope         text not null check (scope in ('national', 'community')),
  territory_id  int null references public.territories(id),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz null,
  constraint positions_scope_territory_chk check (
    (scope = 'national' and territory_id is null) or
    (scope = 'community' and territory_id is not null)
  )
);

comment on table public.positions is 'Cargos orgánicos, histórico (ended_at NULL = vigente). Un usuario puede tener 0..n.';

create index positions_user_id_idx on public.positions(user_id);
create index positions_active_idx on public.positions(role, scope) where ended_at is null;

create table public.app_roles (
  id    serial primary key,
  key   text unique not null,
  label text not null
);

comment on table public.app_roles is 'Catálogo de roles funcionales de la app (ortogonal a lo orgánico): admin, editor, moderator...';

create table public.user_app_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_id     int not null references public.app_roles(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- ============================================================================
-- FUNCIONES HELPER DE AUTORIZACIÓN (SECURITY DEFINER)
-- ============================================================================
-- Se definen SECURITY DEFINER con search_path fijo para: (a) evitar RLS recursiva al
-- consultar user_app_roles/positions/members desde dentro de otras políticas, y (b)
-- poder comprobar el estado real en BD en vez de fiarse del claim `level` del JWT (C2).

create or replace function public.has_app_role(p_user uuid, p_role_key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_app_roles uar
    join public.app_roles ar on ar.id = uar.role_id
    where uar.user_id = p_user and ar.key = p_role_key
  );
$$;

create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_app_role(p_user, 'admin');
$$;

create or replace function public.is_editor(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_app_role(p_user, 'editor') or public.is_admin(p_user);
$$;

create or replace function public.has_position(p_user uuid, p_roles text[], p_scope text default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.positions p
    where p.user_id = p_user
      and p.ended_at is null
      and p.role = any(p_roles)
      and (p_scope is null or p.scope = p_scope)
  );
$$;

-- NOTA: "moderator" es un CARGO ORGÁNICO (positions.role, comunidad) según modelo-datos.md,
-- no un app_role. is_moderator() por tanto consulta positions, no user_app_roles.
create or replace function public.is_moderator(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_position(p_user, array['moderator']) or public.is_admin(p_user);
$$;

create or replace function public.is_coordinator(p_user uuid default auth.uid(), p_territory_id int default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.positions p
    where p.user_id = p_user
      and p.ended_at is null
      and p.role = 'coordinator'
      and p.scope = 'community'
      and (p_territory_id is null or p.territory_id = p_territory_id)
  ) or public.is_admin(p_user);
$$;

create or replace function public.is_treasurer(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_position(p_user, array['treasurer']) or public.is_admin(p_user);
$$;

-- Derecho a voto interno = afiliación activa, independiente del cargo (modelo-datos.md).
create or replace function public.is_active_member(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.user_id = p_user and m.status = 'active'
  );
$$;

-- C2: comprueba antigüedad real en BD (members.started_at), NUNCA el claim del JWT.
create or replace function public.is_active_member_since(p_user uuid, p_min_age interval)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m
    where m.user_id = p_user
      and m.status = 'active'
      and m.started_at is not null
      and m.started_at <= now() - p_min_age
  );
$$;

create or replace function public.is_verified(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p_user
      and (pr.level = 'verified' or pr.identity_verified_at is not null)
  );
$$;

comment on function public.is_active_member_since(uuid, interval) is
  'C2 (revision-seguridad.md): usada por la RLS de ballots. Comprueba members en el momento del INSERT, no el claim level del JWT.';

-- ============================================================================
-- VISTA PÚBLICA SEGURA DE PERFILES (para bylines de artículos y nombres en el organigrama)
-- ============================================================================
-- profiles es "propia + equipo" en lectura (no público), pero positions/articles SÍ son
-- públicos y necesitan mostrar un nombre. Esta vista expone solo id+display_name, nunca
-- email ni datos sensibles. Propiedad de postgres (bypassa RLS de profiles al resolverla).

create view public.profiles_public
  with (security_invoker = false) as
  select id, display_name from public.profiles;

comment on view public.profiles_public is
  'Vista pública mínima (id, display_name) para bylines y organigrama. NUNCA añadir email u otros campos sensibles aquí.';

grant select on public.profiles_public to anon, authenticated;

-- ============================================================================
-- TRIGGER: espejo profile al crear auth.users
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- TRIGGER: level solo modificable por service_role (nunca por el propio usuario)
-- ============================================================================

create or replace function public.profiles_protect_level()
returns trigger
language plpgsql as $$
begin
  -- auth.role() es NULL cuando no hay contexto JWT de PostgREST (conexión directa: la
  -- propia migración, un seed, Studio con el rol postgres/service). Ese caso se trata como
  -- de confianza (equivalente a service_role). Lo que se bloquea es específicamente que un
  -- usuario final con JWT anon/authenticated se autoasigne el nivel.
  if new.level is distinct from old.level and coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'profiles.level solo puede modificarse por el rol de servicio (webhook)';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_level_trg
  before update on public.profiles
  for each row execute function public.profiles_protect_level();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.positions enable row level security;
alter table public.app_roles enable row level security;
alter table public.user_app_roles enable row level security;

-- profiles: lectura propia + equipo (admin/moderator); escritura propia (level protegido por trigger).
create policy profiles_select_own_or_team
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_moderator());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- members: lectura propia o tesorería/admin; escritura SOLO service_role (webhooks Stripe, I7).
create policy members_select_own_or_finance
  on public.members for select
  to authenticated
  using (user_id = auth.uid() or public.is_treasurer() or public.is_admin());

-- positions: lectura pública (organigrama transparente); escritura solo admin.
create policy positions_select_public
  on public.positions for select
  to anon, authenticated
  using (true);

create policy positions_insert_admin
  on public.positions for insert
  to authenticated
  with check (public.is_admin());

create policy positions_update_admin
  on public.positions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy positions_delete_admin
  on public.positions for delete
  to authenticated
  using (public.is_admin());

-- app_roles: catálogo, lectura pública, escritura solo admin.
create policy app_roles_select_public
  on public.app_roles for select
  to anon, authenticated
  using (true);

create policy app_roles_write_admin
  on public.app_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- user_app_roles: lectura propia o admin; escritura solo admin.
create policy user_app_roles_select_own_or_admin
  on public.user_app_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy user_app_roles_write_admin
  on public.user_app_roles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Ahora que existe is_admin(), añadimos la escritura administrada de territories (0002).
create policy territories_insert_admin
  on public.territories for insert
  to authenticated
  with check (public.is_admin());

create policy territories_update_admin
  on public.territories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy territories_delete_admin
  on public.territories for delete
  to authenticated
  using (public.is_admin());

commit;
