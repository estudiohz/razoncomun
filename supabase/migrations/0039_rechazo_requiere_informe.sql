-- 0039_rechazo_requiere_informe.sql
-- Punto 2 del paquete "consecuencia visible" (bucle de retorno, 01/08/2026):
-- el informe de inviabilidad como requisito, no como buena costumbre.
--
-- El ideario (democracia-semidirecta.md, "el bucle de retorno") dice: si una
-- propuesta popular resulta inviable, SE PUBLICA el informe que lo demuestra.
-- Hasta ahora eso dependía de la disciplina del moderador: el estado
-- 'discarded' se podía poner con un clic y sin explicar nada.
--
-- Este trigger lo convierte en regla de BD: una propuesta NO puede pasar a
-- 'discarded' sin una respuesta oficial (D-P10) de al menos 200 caracteres.
-- No es un capricho de longitud: "duplicada" o "no procede" caben en 20 y no
-- explican nada a quien apoyó la propuesta; 200 obliga a un párrafo con
-- motivos. El informe queda publicado en el hilo (official_response ya se
-- muestra destacada) y aparece en la página pública "Qué cambió gracias a ti".
--
-- Se aplica en BD y no en la app por la razón de siempre (C-1): la regla debe
-- resistir un curl directo, no depender de que la UI ponga el campo.

begin;

create or replace function public.proposals_discard_requiere_informe()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'discarded' and (old.status is distinct from 'discarded') then
    if new.official_response is null
       or length(trim(new.official_response)) < 200 then
      raise exception using
        errcode = 'P0001',
        message = 'Para rechazar una propuesta hace falta publicar el informe que lo justifica (mínimo 200 caracteres en la respuesta oficial). "Decir esto no se puede pagar, aquí están los números" es la regla del ideario.';
    end if;
    -- El informe sin fecha ni autor no es un informe publicado.
    if new.official_response_at is null then
      new.official_response_at := now();
    end if;
    if new.official_responder_id is null then
      new.official_responder_id := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

comment on function public.proposals_discard_requiere_informe() is
  '0039: no se puede rechazar (discarded) sin respuesta oficial de ≥200 caracteres — el "informe de inviabilidad" del ideario pasa de costumbre a regla.';

create trigger proposals_discard_requiere_informe_trg
  before update of status on public.proposals
  for each row execute function public.proposals_discard_requiere_informe();

commit;
