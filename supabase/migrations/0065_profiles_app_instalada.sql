-- 0065 · Quién tiene la app instalada (PWA).
--
-- Una PWA no avisa a nadie al instalarse. Lo único detectable es que la web se
-- abra en modo "standalone" (display-mode) o dispare `appinstalled`, así que
-- "instalada" significa "ha abierto la app instalada al menos una vez con sesión
-- iniciada". La función solo toca la fila del propio usuario y solo estas dos
-- columnas: el cliente no puede escribir nada más en profiles por esta vía.
--
-- El push activo NO necesita columna: es que exista una fila del usuario en
-- push_subscriptions (0046).

alter table public.profiles
  add column app_installed_at timestamptz null,
  add column app_last_seen_at timestamptz null;

comment on column public.profiles.app_installed_at is
  'Primera vez que este usuario abrió la web como app instalada (display-mode standalone / appinstalled). Lo rellena mark_app_installed().';
comment on column public.profiles.app_last_seen_at is
  'Última vez que se vio la app instalada abierta con sesión iniciada (se refresca como mucho cada 12 h desde el cliente).';

create or replace function public.mark_app_installed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set app_installed_at = coalesce(app_installed_at, now()),
         app_last_seen_at = now()
   where id = auth.uid();
$$;

revoke all on function public.mark_app_installed() from public, anon;
grant execute on function public.mark_app_installed() to authenticated;
