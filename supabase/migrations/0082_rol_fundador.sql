-- 0082 · Rol de app «Fundador».
--
-- Petición de Sergio (02/11/2026): un fundador es un admin a todos los efectos,
-- con una diferencia: otro admin NO puede quitarle permisos. Por eso:
--
-- 1. `is_admin()` devuelve true también para `founder`. Todo lo que hoy cuelga
--    de is_admin (RLS, guards, claims del JWT, 2FA obligatoria) le alcanza sin
--    tocar nada más.
-- 2. Un trigger en `user_app_roles` impide, a quien no sea fundador:
--      - conceder el rol `founder`,
--      - revocar o cambiar CUALQUIER rol de una cuenta fundadora.
--    Un fundador sí puede, pero nunca dejar al partido sin ningún fundador.
--
-- El trigger solo actúa con sesión de usuario (auth.uid() no nulo). Las
-- operaciones con service_role (webhooks, borrado de cuenta en cascada) no
-- llevan auth.uid(): esas las protege la capa de servidor (actions.ts de
-- /admin/usuarios comprueba is_founder antes de dar de baja o cambiar nivel).

begin;

insert into public.app_roles (key, label)
values ('founder', 'Fundador')
on conflict (key) do nothing;

create or replace function public.is_founder(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_app_role(p_user, 'founder');
$$;

create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_app_role(p_user, 'admin') or public.has_app_role(p_user, 'founder');
$$;

create or replace function public.user_app_roles_protect_founder()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_founder_role int;
begin
  if v_actor is null then
    return coalesce(new, old);
  end if;

  select id into v_founder_role from public.app_roles where key = 'founder';

  if tg_op = 'INSERT' then
    if new.role_id = v_founder_role and not public.is_founder(v_actor) then
      raise exception 'Solo un fundador puede nombrar a otro fundador.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE / UPDATE: la cuenta afectada es la de OLD.
  if public.is_founder(old.user_id) and not public.is_founder(v_actor) then
    raise exception 'No puedes quitar permisos a un fundador.' using errcode = '42501';
  end if;

  if old.role_id = v_founder_role
     and (tg_op = 'DELETE' or new.role_id <> v_founder_role)
     and (select count(*) from public.user_app_roles where role_id = v_founder_role) <= 1 then
    raise exception 'No se puede quitar el último fundador.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists user_app_roles_protect_founder on public.user_app_roles;
create trigger user_app_roles_protect_founder
  before insert or update or delete on public.user_app_roles
  for each row execute function public.user_app_roles_protect_founder();

commit;
