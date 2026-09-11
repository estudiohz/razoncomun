-- 0056_carnet_socio.sql
--
-- Carnet de socio en la wallet (docs/tecnico/carnet-afiliado.md, olas C0-C2).
--
-- Nota de numeración: el documento de arquitectura habla de `0054` porque se
-- escribió antes que la baja de cuenta. Cuando llegó el turno de ejecutarlo ya
-- estaba aplicada la `0055`, así que esta va como `0056` — el orden de los
-- ficheros tiene que coincidir con el orden en que se aplicaron de verdad, o
-- el siguiente que reconstruya la base desde cero se encontrará una `0054`
-- que nunca corrió en ese punto.
--
-- UNA COLUMNA Y NADA MÁS. No hay tabla de pases ni historial de emisiones: el
-- carnet se construye al vuelo cada vez que se pide, porque un pase guardado
-- es un pase que se queda obsoleto y no hay nada en él que no esté ya en
-- `profiles` y `members`.
--
-- POR QUÉ UN UUID PROPIO Y NO EL `id` DEL USUARIO
--   Este identificador acaba impreso en un QR que cualquiera puede fotografiar.
--   El `id` de `auth.users` es la llave de todo el sistema y no debe salir de
--   ahí. El `member_number` tampoco sirve: es correlativo, o sea adivinable —
--   con el 42 sabes que existen el 41 y el 43.
--
--   Y al ser una columna propia se puede ROTAR: si alguien pierde el móvil o
--   le filtran el carnet, se le genera otro uuid y todos sus pases anteriores
--   dejan de verificar, sin tocar los de nadie más.

begin;

alter table public.profiles
  add column if not exists carnet_uid uuid not null default extensions.gen_random_uuid();

create unique index if not exists profiles_carnet_uid_idx on public.profiles (carnet_uid);

comment on column public.profiles.carnet_uid is
  '0056: identificador público del carnet, el que viaja dentro del QR. Deliberadamente NO es `id` (llave del sistema, no debe imprimirse) ni `member_number` (correlativo, adivinable). Rotarlo invalida los carnets anteriores de esa persona y solo los suyos.';

/**
 * Rota el identificador del carnet: móvil perdido, carnet filtrado, o un
 * socio que simplemente lo pide. Devuelve el nuevo uuid.
 */
create or replace function public.rotar_carnet_uid(p_user uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
begin
  update public.profiles
     set carnet_uid = extensions.gen_random_uuid(), updated_at = now()
   where id = p_user
  returning carnet_uid into nuevo;

  return nuevo;
end;
$$;

comment on function public.rotar_carnet_uid(uuid) is
  '0056: emite un identificador de carnet nuevo. Los pases que la persona ya tuviera guardados en la wallet dejan de dar válido al escanearlos.';

revoke execute on function public.rotar_carnet_uid(uuid) from anon;

/**
 * Los datos del carnet a partir del identificador del QR, resueltos en el
 * servidor en el momento del escaneo.
 *
 * NO devuelve el nombre. Quien escanea tiene la tarjeta delante y ahí está
 * escrito; publicarlo aquí convertiría cada QR en un endpoint para averiguar
 * la militancia de cualquiera a quien le fotografíes el carnet, y la
 * afiliación política es dato de categoría especial (Art. 9 RGPD).
 *
 * La validez la decide `is_active_member()`, que es la MISMA función que
 * decide quién puede votar (0037: incluye `paused`, excluye `past_due`).
 * Reescribir aquí el criterio garantizaría que algún día divergen.
 */
create or replace function public.carnet_por_uid(p_uid uuid)
returns table (valido boolean, member_number int, nivel text, socio_desde timestamptz)
language sql stable security definer set search_path = public as $$
  select
    public.is_active_member(p.id) and p.anonymized_at is null as valido,
    p.member_number,
    p.level as nivel,
    p.member_since as socio_desde
  from public.profiles p
  where p.carnet_uid = p_uid;
$$;

comment on function public.carnet_por_uid(uuid) is
  '0056: resuelve el QR del carnet. Devuelve la validez calculada AHORA, nunca el nombre. Una baja (anonymized_at) invalida el carnet aunque la afiliación siguiera figurando.';

grant execute on function public.carnet_por_uid(uuid) to anon, authenticated;

commit;
