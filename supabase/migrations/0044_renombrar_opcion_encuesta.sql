-- 0044_renombrar_opcion_encuesta.sql
-- Corrección de erratas en opciones de encuesta CON votos emitidos (petición
-- de Sergio, 02/08/2026: "si soy el creador debería poder editar... faltas de
-- ortografía").
--
-- El problema: cada respuesta guarda el TEXTO de la opción elegida. Cambiar
-- "Si" por "Sí" en la pregunta dejaría los votos ya emitidos apuntando a una
-- opción que ya no existe (y el agregado los mostraría como una opción
-- fantasma separada). La solución no es prohibir la corrección: es MIGRAR los
-- votos junto con ella, atómicamente.
--
-- SECURITY DEFINER porque la RLS de survey_responses solo deja a cada usuario
-- tocar SU respuesta — la migración de erratas toca las de todos, y eso debe
-- poder hacerlo únicamente un admin/coordinator (verificado dentro).

begin;

create or replace function public.survey_renombrar_opcion(
  p_question uuid,
  p_vieja text,
  p_nueva text
)
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not (public.is_admin() or public.is_coordinator()) then
    raise exception 'Solo admin/coordinator puede renombrar opciones';
  end if;
  if p_vieja is null or p_nueva is null or length(trim(p_nueva)) = 0 then
    raise exception 'Opción inválida';
  end if;
  if p_vieja = p_nueva then
    return 0;
  end if;

  update public.survey_responses r
     set answer = case
       when jsonb_typeof(r.answer) = 'array' then (
         select coalesce(
           jsonb_agg(case when e.value = to_jsonb(p_vieja) then to_jsonb(p_nueva) else e.value end),
           '[]'::jsonb
         )
         from jsonb_array_elements(r.answer) as e(value)
       )
       else to_jsonb(p_nueva)
     end
   where r.question_id = p_question
     and (
       r.answer = to_jsonb(p_vieja)
       or (jsonb_typeof(r.answer) = 'array' and r.answer @> jsonb_build_array(p_vieja))
     );

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.survey_renombrar_opcion(uuid, text, text) is
  '0044: renombra una opción en TODOS los votos emitidos de una pregunta (corrección de erratas sin perder votos). Solo admin/coordinator. Devuelve cuántas respuestas se migraron.';

grant execute on function public.survey_renombrar_opcion(uuid, text, text) to authenticated;

commit;
