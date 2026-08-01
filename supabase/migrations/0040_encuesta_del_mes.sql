-- 0040_encuesta_del_mes.sql
-- "La encuesta del mes" (petición de Sergio, 01/08/2026): el elemento central
-- de la app. Cada mes, un puñado de propuestas fijadas por el equipo forman la
-- votación destacada; al acabar el año queda el listado de qué se votó cada
-- mes. Es el "ritual mensual" del ideario (ventanas fijas de votación,
-- democracia-semidirecta.md) hecho interfaz.
--
-- Modelo mínimo: una columna en `proposals` con el mes destacado (primer día
-- del mes, tipo date — permite ordenar, agrupar por año y comparar sin parsear
-- texto). Sin tabla nueva: una propuesta se fija a lo sumo en un mes, y el
-- histórico anual sale de un group by.

begin;

alter table public.proposals
  add column featured_month date null
    check (featured_month is null or featured_month = date_trunc('month', featured_month)::date);

comment on column public.proposals.featured_month is
  '0040: mes en que la propuesta forma parte de "la encuesta del mes" (siempre día 1). La fija coordinator/admin desde la ficha de moderación; protegida por trigger igual que status.';

create index proposals_featured_month_idx
  on public.proposals (featured_month desc)
  where featured_month is not null;

-- La MISMA protección que ya tiene `status` (0005): sin esto, el autor de una
-- propuesta en seed/deliberation podría autofijarse en el mes por PATCH
-- directo a PostgREST — su policy de UPDATE se lo permitiría. La curación del
-- mes es una decisión editorial, no del autor.
create or replace function public.proposals_protect_featured()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.featured_month is distinct from old.featured_month
     and not (public.is_coordinator() or public.is_admin()) then
    raise exception 'Solo coordinator/admin puede fijar una propuesta en la encuesta del mes';
  end if;
  return new;
end;
$$;

create trigger proposals_protect_featured_trg
  before update on public.proposals
  for each row execute function public.proposals_protect_featured();

commit;
