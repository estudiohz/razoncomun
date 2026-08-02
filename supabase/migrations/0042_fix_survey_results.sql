-- 0042_fix_survey_results.sql
-- Corrección de 0041, encontrada por el gate E2E contra dev: la agregación
-- usaba jsonb_array_elements dentro de un CASE y Postgres lo rechaza en
-- ejecución (0A000: "set-returning functions are not allowed in CASE") — la
-- migración aplicó sin error porque el cuerpo plpgsql solo se planifica al
-- ejecutarse. El RPC devolvía error y /mes no podía pintar resultados.
--
-- Arreglo: normalizar SIEMPRE a array (jsonb_build_array para el escalar) y
-- expandir con jsonb_array_elements en el LATERAL, fuera de todo CASE — justo
-- lo que sugiere el hint del propio error.

begin;

create or replace function public.survey_results(p_survey_id uuid)
returns table (
  question_id uuid,
  option_value text,
  afiliados bigint,
  simpatizantes bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_visibility text;
  v_closes timestamptz;
begin
  select results_visibility, closes_at into v_visibility, v_closes
  from public.surveys where id = p_survey_id;

  if v_visibility is null then
    return;
  end if;

  if v_visibility = 'internal' and not (public.is_admin() or public.is_coordinator()) then
    return;
  end if;

  if v_visibility = 'on_close' and now() < v_closes
     and not (public.is_admin() or public.is_coordinator()) then
    return;
  end if;

  return query
  select
    r.question_id,
    trim(both '"' from o.valor::text) as option_value,
    count(*) filter (where r.user_id is not null and public.is_active_member(r.user_id)) as afiliados,
    count(*) filter (where r.user_id is null or not public.is_active_member(r.user_id)) as simpatizantes
  from public.survey_responses r
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.answer) = 'array' then r.answer else jsonb_build_array(r.answer) end
  ) as o(valor)
  where r.survey_id = p_survey_id
  group by r.question_id, trim(both '"' from o.valor::text);
end;
$$;

commit;
