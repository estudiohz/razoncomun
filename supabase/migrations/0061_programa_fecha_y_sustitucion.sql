-- 0061 · /programa: fecha real de aprobación y sustitución de medidas.
--
--  1. adopted_at: cuándo pasó la propuesta a Aprobado/Planeado. Hasta ahora
--     /programa usaba updated_at, que cambia con cualquier edición posterior.
--  2. supersedes_id: la propuesta NUEVA (más completa o mejorada) apunta a la
--     que sustituye. No se guarda ningún "estado sustituida" en la antigua:
--     se deriva (la antigua está sustituida si existe una propuesta
--     Aprobada/Planeada con supersedes_id = su id). Así no hay dos sitios que
--     mantener sincronizados y la antigua conserva su historial, su debate y
--     sus votos intactos y consultables.

alter table public.proposals
  add column adopted_at    timestamptz null,
  add column supersedes_id uuid null references public.proposals(id) on delete set null;

alter table public.proposals
  add constraint proposals_no_se_sustituye_a_si_misma check (supersedes_id is null or supersedes_id <> id);

comment on column public.proposals.adopted_at is
  'Primera vez que la propuesta pasó a adopted/planned. Lo rellena el trigger; no se edita a mano.';
comment on column public.proposals.supersedes_id is
  'Esta propuesta sustituye a la indicada cuando es Aprobada/Planeada. La antigua deja de mostrarse como vigente en /programa pero sigue siendo consultable.';

create index proposals_supersedes_id_idx on public.proposals (supersedes_id) where supersedes_id is not null;

-- Las que ya están aprobadas: la mejor aproximación disponible es updated_at.
update public.proposals
   set adopted_at = updated_at
 where status in ('adopted', 'planned') and adopted_at is null;

create or replace function public.proposals_set_adopted_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('adopted', 'planned') then
    if tg_op = 'INSERT' or old.status not in ('adopted', 'planned') then
      new.adopted_at := coalesce(new.adopted_at, now());
    else
      new.adopted_at := old.adopted_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger proposals_set_adopted_at_trg
  before insert or update on public.proposals
  for each row execute function public.proposals_set_adopted_at();
