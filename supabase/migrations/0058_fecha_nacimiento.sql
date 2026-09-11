-- 0058_fecha_nacimiento.sql
--
-- Fecha de nacimiento del socio (petición de Sergio, 04/09/2026).
--
-- PARA QUÉ, que en este proyecto no es retórico: `autenticacion-y-niveles.md`
-- fija el principio de "mínimo dato necesario" y el registro básico pide solo
-- el email. Un dato personal nuevo tiene que justificarse o no entra.
--
--   · **Edad mínima para ser socio.** Sin fecha de nacimiento no hay forma de
--     comprobarla, y es un requisito de los estatutos, no una curiosidad.
--   · **Libro de socios** (Ley de Partidos, LO 8/2007): identifica a la
--     persona junto con el nombre y el NIF.
--
-- NO se pide en el registro básico. Quien solo se registra para participar en
-- el foro o votar consultivamente no tiene por qué darla — no hay base legal
-- para pedírsela. Nace con la condición de socio, igual que el NIF (0022).
--
-- Va en `profiles` y no en una tabla aparte —a diferencia del NIF— porque no
-- es un identificador nacional: su radio de exposición es mucho menor y no
-- justifica el coste de otra tabla con su propia RLS.

begin;

alter table public.profiles
  add column if not exists birth_date date;

comment on column public.profiles.birth_date is
  '0058: fecha de nacimiento. Para comprobar la edad mínima de socio y para el libro de socios (LO 8/2007). NO se pide en el registro básico: solo a quien se hace socio. Null en el resto.';

/**
 * Cordura, no reglas de negocio: rechaza fechas futuras y edades imposibles.
 * La edad MÍNIMA para ser socio no se fija aquí a propósito — es una decisión
 * de estatutos y cambiarla no debería exigir una migración.
 */
alter table public.profiles
  drop constraint if exists profiles_birth_date_sensata;
alter table public.profiles
  add constraint profiles_birth_date_sensata
  check (
    birth_date is null
    or (birth_date > current_date - interval '120 years' and birth_date < current_date)
  );

commit;
