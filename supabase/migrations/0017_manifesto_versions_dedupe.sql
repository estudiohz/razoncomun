-- 0017_manifesto_versions_dedupe.sql
-- Deuda declarada en D-014 (docs/tecnico/decisiones-construccion.md): manifesto_point_versions
-- quedó con 45 filas / 15 combinaciones (point_id, version) duplicadas (hasta 3 copias),
-- residuo de las repeticiones de rc-02 al probar "aplicar en limpio desde cero". D-013 hace
-- este historial PÚBLICO como garantía de que nadie reescribe el programa en silencio:
-- publicarlo con duplicados de desarrollo destruye esa credibilidad.
--
-- Purga: para cada (point_id, version) se conserva la fila más antigua (created_at asc, id
-- como desempate estable) y se borran las copias posteriores. Las filas duplicadas proceden
-- de repetir la MISMA operación de seed/edición de prueba, así que su contenido (title/body)
-- es equivalente entre copias; no hay pérdida de información real, solo de ruido de desarrollo.
-- Después se añade la restricción única (point_id, version) para que esto no pueda reaparecer.

begin;

-- Diagnóstico dejado en el propio historial de la migración (visible en el log de aplicación):
-- cuenta de filas y de combinaciones duplicadas ANTES de purgar.
do $$
declare
  v_total_before  int;
  v_dupe_groups   int;
begin
  select count(*) into v_total_before from public.manifesto_point_versions;
  select count(*) into v_dupe_groups from (
    select point_id, version
    from public.manifesto_point_versions
    group by point_id, version
    having count(*) > 1
  ) d;
  raise notice 'manifesto_point_versions ANTES de purgar: % filas totales, % combinaciones (point_id, version) duplicadas',
    v_total_before, v_dupe_groups;
end;
$$;

with ranked as (
  select
    id,
    row_number() over (
      partition by point_id, version
      order by created_at asc, id asc
    ) as rn
  from public.manifesto_point_versions
)
delete from public.manifesto_point_versions v
using ranked r
where v.id = r.id
  and r.rn > 1;

do $$
declare
  v_total_after int;
  v_dupe_after  int;
begin
  select count(*) into v_total_after from public.manifesto_point_versions;
  select count(*) into v_dupe_after from (
    select point_id, version
    from public.manifesto_point_versions
    group by point_id, version
    having count(*) > 1
  ) d;
  raise notice 'manifesto_point_versions DESPUÉS de purgar: % filas totales, % combinaciones duplicadas restantes',
    v_total_after, v_dupe_after;
  if v_dupe_after > 0 then
    raise exception 'purga incompleta: quedan % combinaciones (point_id, version) duplicadas', v_dupe_after;
  end if;
end;
$$;

-- Restricción única de esquema: impide que esto vuelva a ocurrir, sin confiar en la disciplina
-- de quien aplique el siguiente seed o prueba de "aplicar en limpio".
alter table public.manifesto_point_versions
  add constraint manifesto_point_versions_point_version_uidx unique (point_id, version);

commit;
