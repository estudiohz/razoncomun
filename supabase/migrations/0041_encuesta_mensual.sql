-- 0041_encuesta_mensual.sql
-- Ola E0 de la encuesta mensual (diseño aprobado por Sergio, 02/08/2026).
-- El sistema de encuestas (0007) ya modela lo esencial — respuestas POR
-- PREGUNTA con índice único por usuario, que es lo que hace válido responder
-- en 3 veces. Aquí se añade lo que faltaba:
--
--  1. La encuesta "del mes": surveys.featured_month + único parcial (una por
--     mes). El botón central de la app lleva a ella.
--  2. Trazabilidad pregunta → propuesta: el ciclo completo del ideario
--     (propuesta → debate → elegida → encuesta) enlazado, más el texto de
--     info ampliada que escribe quien monta la encuesta.
--  3. Respuestas EDITABLES hasta el cierre (decisión de Sergio). La RLS de
--     0007 solo tenía INSERT: un cambio de respuesta moriría en silencio —
--     la misma clase de fallo que ya pagamos en 0033.
--  4. Resultados agregados por RPC: la RLS solo deja leer la respuesta
--     propia (correcto), así que el agregado público sale de una función
--     SECURITY DEFINER que devuelve SOLO recuentos, segmentados
--     afiliado/simpatizante (el "voto consultivo junto al vinculante" del
--     ideario), y únicamente cuando la visibilidad lo permite.

begin;

-- ============================================================================
-- 1. La encuesta del mes
-- ============================================================================

alter table public.surveys
  add column featured_month date null
    check (featured_month is null or featured_month = date_trunc('month', featured_month)::date);

comment on column public.surveys.featured_month is
  '0041: mes del que esta encuesta es "la encuesta del mes" (siempre día 1). Única por mes. Es lo que muestra /mes y el botón central de la app.';

create unique index surveys_featured_month_uidx
  on public.surveys (featured_month)
  where featured_month is not null;

-- ============================================================================
-- 2. Pregunta ← propuesta + info ampliada
-- ============================================================================

alter table public.survey_questions
  add column proposal_id uuid null references public.proposals(id) on delete set null,
  add column info text null;

comment on column public.survey_questions.proposal_id is
  '0041: propuesta de la que nace la pregunta. Enlaza la encuesta con la discusión, los apoyos y el hilo completo — el ciclo del ideario, trazable.';
comment on column public.survey_questions.info is
  '0041: texto de "info ampliada" que se despliega bajo la pregunta (argumentos, contexto). Lo escribe quien monta la encuesta.';

-- ============================================================================
-- 3. Editable hasta el cierre
-- ============================================================================
-- Solo la respuesta propia, solo con la ventana abierta, y solo en encuestas
-- nominales (una respuesta anónima no tiene dueño que pueda reclamarla).

create policy survey_responses_update_own_while_open
  on public.survey_responses for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.surveys s
      where s.id = survey_id and now() between s.opens_at and s.closes_at
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.surveys s
      where s.id = survey_id and now() between s.opens_at and s.closes_at
    )
  );

comment on policy survey_responses_update_own_while_open on public.survey_responses is
  '0041: puedes cambiar tu respuesta hasta que cierre la ventana (decisión de Sergio). Tras el cierre, nada se toca — el resultado es el resultado.';

-- ============================================================================
-- 4. Resultados agregados (sin exponer jamás filas individuales)
-- ============================================================================
-- Devuelve, por pregunta y opción, cuántos respondieron — partido en afiliados
-- (is_active_member, que desde 0037 incluye cuota pausada) y simpatizantes.
-- Respeta results_visibility: 'live' siempre; 'on_close' solo cerrada;
-- 'internal' solo admin/coordinator.

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
    return; -- encuesta inexistente
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
    -- Respuestas single/multiple guardan la opción en answer; text/scale se
    -- agregan por su valor textual tal cual.
    trim(both '"' from o.valor::text) as option_value,
    count(*) filter (where r.user_id is not null and public.is_active_member(r.user_id)) as afiliados,
    count(*) filter (where r.user_id is null or not public.is_active_member(r.user_id)) as simpatizantes
  from public.survey_responses r
  cross join lateral (
    select case
      when jsonb_typeof(r.answer) = 'array' then jsonb_array_elements(r.answer)
      else r.answer
    end as valor
  ) o
  where r.survey_id = p_survey_id
  group by r.question_id, trim(both '"' from o.valor::text);
end;
$$;

comment on function public.survey_results(uuid) is
  '0041: agregado de resultados por pregunta y opción, segmentado afiliados/simpatizantes (el voto consultivo se publica junto al vinculante — ideario). Nunca devuelve filas individuales. Respeta results_visibility.';

grant execute on function public.survey_results(uuid) to anon, authenticated;

commit;
