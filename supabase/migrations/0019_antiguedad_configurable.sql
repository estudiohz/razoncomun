-- 0019_antiguedad_configurable.sql
--
-- La antigüedad mínima para voto vinculante pasa de estar fijada en el código
-- (0018: `interval '1 week'`) a ser configurable desde el panel de admin, tal
-- como pidió Sergio.
--
-- ⚠️ EL RIESGO QUE ESTA MIGRACIÓN CIERRA
-- Un parámetro global y editable se puede cambiar CON UNA VOTACIÓN ABIERTA.
-- Un administrador podría bajar el plazo de 7 a 1 día a mitad de una votación
-- reñida y habilitar de golpe a afiliados recientes. Para un partido que basa
-- su propuesta en democracia interna auditable, ese es un titular devastador
-- y, además, indistinguible de un error administrativo de buena fe.
--
-- SOLUCIÓN: se sella con la votación, igual que `quorum` y `threshold` (I6).
--   - `settings.min_membership_days` es el valor por defecto para votaciones NUEVAS.
--   - `votes.min_membership_days` guarda el valor VIGENTE al crear la votación.
--   - `ballot_eligible` usa el de la VOTACIÓN, nunca el global.
-- Cambiar el ajuste no altera ninguna votación ya creada. Es el mismo principio
-- que el censo congelado de rc-06: las reglas se publican de antemano y no se
-- tocan con la partida empezada.
--
-- TRANSPARENCIA: al quedar en la fila de la votación, la regla aplicada es
-- consultable públicamente por cualquiera para cada votación concreta. El
-- parámetro deja de ser un riesgo y pasa a ser verificable.
--
-- Cambio del orquestador sobre la zona de rc-02-datos (dueño del esquema).

begin;

-- ---------------------------------------------------------------------------
-- 1. Ajustes globales del partido (clave/valor, ampliable)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid null references public.profiles(id),
  updated_at  timestamptz not null default now()
);

comment on table public.settings is
  'Ajustes globales editables desde el panel. Los que afectan a votaciones se '
  'SELLAN en la fila de votes al crearla: cambiarlos aquí nunca altera una '
  'votación ya abierta (mismo principio que quorum/threshold, I6).';

alter table public.settings enable row level security;

-- Lectura pública: las reglas del juego son públicas por diseño.
drop policy if exists settings_select_public on public.settings;
create policy settings_select_public on public.settings
  for select using (true);

-- Escritura solo admin. La UI escribe vía server action con service_role.
drop policy if exists settings_write_admin on public.settings;
create policy settings_write_admin on public.settings
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into public.settings (key, value) values
  ('min_membership_days', '7'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. La votación sella el valor vigente al crearse
-- ---------------------------------------------------------------------------
alter table public.votes
  add column if not exists min_membership_days int not null default 7
    check (min_membership_days between 0 and 3650);

comment on column public.votes.min_membership_days is
  'Antigüedad mínima de afiliación exigida para voto vinculante EN ESTA '
  'votación. Se sella al crearla desde settings.min_membership_days; cambiar '
  'el ajuste global no afecta a votaciones existentes (I6).';

create or replace function public.votes_seal_min_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Al crear: toma el valor global vigente si no se especificó explícitamente.
  if tg_op = 'INSERT' then
    if new.min_membership_days is null or new.min_membership_days = 7 then
      new.min_membership_days := coalesce(
        (select (value #>> '{}')::int from public.settings where key = 'min_membership_days'),
        7
      );
    end if;
    return new;
  end if;
  -- Al actualizar: sellado. Ni admin puede cambiarlo una vez creada.
  if new.min_membership_days is distinct from old.min_membership_days then
    raise exception
      'min_membership_days queda sellado al crear la votación (I6): no se puede cambiar la regla con la votación en curso';
  end if;
  return new;
end;
$$;

drop trigger if exists votes_seal_min_membership_trg on public.votes;
create trigger votes_seal_min_membership_trg
  before insert or update on public.votes
  for each row execute function public.votes_seal_min_membership();

-- ---------------------------------------------------------------------------
-- 3. La elegibilidad usa el valor SELLADO en la votación, no el global
-- ---------------------------------------------------------------------------
create or replace function public.ballot_eligible(p_user uuid, p_vote_id uuid, p_weight smallint)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_weight = 0 then true
    when p_weight = 1 then (
      select
        public.is_active_member_since(p_user, make_interval(days => v.min_membership_days))
        and public.is_verified(p_user)
      from public.votes v
      where v.id = p_vote_id
    )
    else false
  end;
$$;

comment on function public.ballot_eligible(uuid, uuid, smallint) is
  'Elegibilidad de voto (D-017/D-018): consultivo abierto a registrados; '
  'vinculante exige identidad verificada Y antigüedad >= votes.min_membership_days, '
  'el valor sellado en esa votación concreta, no el ajuste global vigente.';

commit;
