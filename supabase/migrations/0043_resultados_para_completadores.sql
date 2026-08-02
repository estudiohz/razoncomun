-- 0043_resultados_para_completadores.sql
-- Petición de Sergio (02/08/2026): quien TERMINA la encuesta ve cómo van los
-- resultados, aunque la visibilidad general sea "al cierre".
--
-- Es la mecánica de incentivo clásica de las encuestas bien hechas: el
-- marcador es la recompensa por completar. Y mantiene la protección original
-- contra el sesgo: quien aún no ha respondido no ve por dónde va la mayoría
-- (no puede "votar con el rebaño"); quien ya respondió todo, ya no puede ser
-- influido en lo que le queda — no le queda nada.
--
-- La regla vive en el RPC (BD) y no en la página: si estuviera solo en la UI,
-- cualquiera podría llamar al RPC a mano y ver el marcador sin completar.

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
  v_preguntas int;
  v_respondidas int;
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
    -- 0043: excepción — quien completó TODAS las preguntas ve el marcador.
    if auth.uid() is null then
      return;
    end if;
    select count(*) into v_preguntas from public.survey_questions q where q.survey_id = p_survey_id;
    select count(*) into v_respondidas
      from public.survey_responses r
     where r.survey_id = p_survey_id and r.user_id = auth.uid();
    if v_preguntas = 0 or v_respondidas < v_preguntas then
      return;
    end if;
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

comment on function public.survey_results(uuid) is
  '0043: agregado por pregunta y opción, segmentado afiliados/simpatizantes. Con visibilidad on_close y ventana abierta, SOLO lo ve quien completó todas las preguntas (el marcador es la recompensa por terminar; quien no respondió no puede votar viendo a la mayoría). Nunca filas individuales.';

commit;
