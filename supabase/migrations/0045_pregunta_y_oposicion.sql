-- 0045_pregunta_y_oposicion.sql
-- Petición de Sergio (07/08/2026): una propuesta votada por 500 personas donde
-- solo 20 "apoyan" no refleja que las otras 480 estén EN CONTRA — hasta ahora
-- proposal_supports solo modela un +1, sin postura negativa. Además, el título
-- de una propuesta puede ser ambiguo; se añade un campo "pregunta" explícito
-- para que quien vota sepa exactamente sobre qué se está posicionando.
--
-- Diseño: en vez de crear una segunda tabla espejo, se añade `stance` a
-- proposal_supports (1 fila por usuario/propuesta = su postura actual:
-- 'support' u 'oppose'; borrar la fila = sin postura). Mantiene la PK
-- compuesta (proposal_id, user_id) => 1 persona, 1 postura por propuesta, tal
-- como pedía el diseño original de "apoyo 1-clic".

begin;

alter table public.proposals
  add column question text null;

comment on column public.proposals.question is
  'Formulación de la propuesta como pregunta cerrada ("¿Debería...?") para que el voto a favor/en contra sea inequívoco aunque el título sea ambiguo. Opcional (propuestas antiguas no lo tienen).';

alter table public.proposals
  add column oppose_count int not null default 0;

alter table public.proposal_supports
  add column stance text not null default 'support' check (stance in ('support', 'oppose'));

comment on column public.proposal_supports.stance is
  'Postura actual del usuario sobre la propuesta. La fila representa siempre la postura VIGENTE (no un historial): cambiar de postura hace UPDATE, no un segundo INSERT.';

-- ============================================================================
-- support_count / oppose_count por trigger (nunca desde el cliente)
-- ============================================================================

create or replace function public.proposals_recount_supports()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.proposal_id, old.proposal_id);
  update public.proposals
    set support_count = (select count(*) from public.proposal_supports where proposal_id = target_id and stance = 'support'),
        oppose_count  = (select count(*) from public.proposal_supports where proposal_id = target_id and stance = 'oppose')
    where id = target_id;
  return null;
end;
$$;

drop trigger if exists proposal_supports_recount on public.proposal_supports;
create trigger proposal_supports_recount
  after insert or delete or update of stance on public.proposal_supports
  for each row execute function public.proposals_recount_supports();

-- ============================================================================
-- Congelación (0032 D-P6/D-P7): el cambio de postura también debe bloquearse
-- fuera de votación abierta, no solo el alta/baja.
-- ============================================================================

drop trigger if exists proposal_supports_check_open_trg on public.proposal_supports;
create trigger proposal_supports_check_open_trg
  before insert or delete or update of stance on public.proposal_supports
  for each row execute function public.proposal_supports_check_open();

-- ============================================================================
-- RLS: faltaba permitir que cada usuario actualice SU fila (cambiar de
-- postura in-place); select/insert/delete ya cubrían este caso.
-- ============================================================================

create policy proposal_supports_update_own
  on public.proposal_supports for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
