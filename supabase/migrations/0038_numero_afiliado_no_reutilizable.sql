-- 0038_numero_afiliado_no_reutilizable.sql
-- Corrección de 0037, encontrada al verificarla contra dev.
--
-- Síntoma: `asignar_numero_afiliado()` calculaba el siguiente como
-- `max(member_number) + 1` sobre `profiles`. Si un perfil se elimina —y el
-- panel de admin tiene botón para ello, además del borrado por petición RGPD—
-- su número desaparece de la tabla y **el siguiente afiliado lo reutiliza**.
--
-- Eso rompe justo la garantía que se buscaba: dos personas distintas acabarían
-- siendo "el afiliado 7" en momentos distintos, y el libro de afiliados dejaría
-- de ser una referencia estable (Ley de Partidos, LO 8/2007). Un certificado
-- fiscal antiguo o un acta que cite al afiliado 7 pasaría a apuntar a otro.
--
-- Arreglo: el contador deja de derivarse de las filas vivas y pasa a ser un
-- valor propio en `settings` (`last_member_number`), que solo crece. Sigue
-- siendo correlativo y sin huecos —el contador se incrementa dentro de la
-- misma transacción que asigna, así que un fallo revierte ambos— pero un
-- número emitido no vuelve nunca al saco aunque su titular desaparezca.

begin;

-- Arranca en el máximo ya emitido para no chocar con lo asignado por 0037.
insert into public.settings (key, value)
values ('last_member_number', to_jsonb(coalesce((select max(member_number) from public.profiles), 0)))
on conflict (key) do update
  set value = to_jsonb(greatest(
        coalesce((select max(member_number) from public.profiles), 0),
        coalesce((public.settings.value)::int, 0)
      ));

comment on table public.settings is
  'Ajustes globales editables desde el panel. Incluye `last_member_number` (0038): último número de afiliado emitido. Solo crece — nunca se recicla un número, aunque se borre el perfil de su titular.';

create or replace function public.asignar_numero_afiliado(p_user uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  siguiente int;
  actual    int;
begin
  select member_number into actual from public.profiles where id = p_user;
  if actual is not null then
    return actual;  -- reingreso: conserva el suyo
  end if;

  -- Serializa las asignaciones concurrentes: sin esto, dos altas simultáneas
  -- leerían el mismo contador. Se libera al cerrar la transacción.
  perform pg_advisory_xact_lock(hashtext('numero_afiliado'));

  update public.settings
     set value = to_jsonb((value)::int + 1),
         updated_at = now()
   where key = 'last_member_number'
  returning (value)::int into siguiente;

  if siguiente is null then
    raise exception 'Falta el contador last_member_number en settings (0038)';
  end if;

  update public.profiles set member_number = siguiente where id = p_user;
  return siguiente;
end;
$$;

comment on function public.asignar_numero_afiliado(uuid) is
  '0038: devuelve el número de afiliado, asignando el siguiente del contador `settings.last_member_number` si aún no tiene. Idempotente. El contador solo crece: borrar un perfil NO libera su número.';

commit;
