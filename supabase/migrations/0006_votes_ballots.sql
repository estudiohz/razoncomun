-- 0006_votes_ballots.sql
-- Votaciones vinculantes (ventana mensual) y ballots.
--
-- D-001 (decisiones-construccion.md, 19/07/2026): el voto es PÚBLICO NOMINAL, NO se
-- seudonimiza. La lectura de ballots es pública (quién votó qué es visible).
--
-- C2 (revision-seguridad.md): la política de INSERT en ballots NO confía en el claim
-- `level` del JWT. Comprueba con EXISTS contra members.status='active' y antigüedad
-- >= 3 meses en el momento del INSERT (función public.is_active_member_since, definida
-- en 0003_identity.sql). Para scope='manifesto' exige además nivel verified (Stripe Identity).
--
-- I6 (revision-seguridad.md): quorum/threshold/opens_at/scope quedan sellados al abrir
-- la votación (trigger votes_protect_sealed_rules). ballots es de solo INSERT: ni
-- siquiera admin puede editar o borrar un voto ya emitido (integridad del censo congelado).
--
-- ⚠️ AMBIGÜEDAD DE SPEC A CONFIRMAR: modelo-datos.md declara
-- `ballots(..., choice text, weight smallint, -- vinculante|consultivo)`. "weight smallint"
-- comentado como "vinculante|consultivo" no encaja literalmente (esos son dos textos, no
-- un peso numérico). Se implementa aquí como smallint con dos valores posibles:
-- 1 = voto vinculante, 0 = voto consultivo — que es la lectura más consistente con el
-- resto del documento ("consultivo: registered; vinculante: member activo ≥3 meses").
-- Si la intención real era otra (p.ej. un peso fraccional de voto), es un cambio menor
-- de constraint, avisar al arquitecto.

begin;

create table public.votes (
  id           uuid primary key default extensions.gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id),
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  quorum       int not null,
  threshold    numeric not null,     -- fracción o nº de votos necesarios (regla publicada de antemano)
  scope        text not null check (scope in ('department', 'manifesto')),
  created_by   uuid null references public.profiles(id),
  created_at   timestamptz not null default now(),
  constraint votes_window_chk check (closes_at > opens_at)
);

comment on table public.votes is 'Ventana de votación vinculante sobre una proposal. Reglas (quorum/threshold) publicadas de antemano y selladas al abrir (I6).';

create table public.ballots (
  vote_id  uuid not null references public.votes(id),
  user_id  uuid not null references public.profiles(id),
  choice   text not null,
  weight   smallint not null check (weight in (0, 1)),  -- 1=vinculante, 0=consultivo (ver nota arriba)
  cast_at  timestamptz not null default now(),
  primary key (vote_id, user_id)
);

comment on table public.ballots is 'D-001: voto público nominal, sin seudonimizar. Solo INSERT — ni admin puede editar/borrar un voto emitido.';

create index ballots_vote_idx on public.ballots(vote_id);
create index ballots_user_idx on public.ballots(user_id);

alter table public.manifesto_point_versions
  add constraint manifesto_point_versions_vote_fk foreign key (vote_id) references public.votes(id);

-- ============================================================================
-- Funciones de elegibilidad (C2: consultan BD, nunca el claim del JWT)
-- ============================================================================

create or replace function public.vote_is_open(p_vote_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.votes v
    where v.id = p_vote_id and now() between v.opens_at and v.closes_at
  );
$$;

create or replace function public.ballot_eligible(p_user uuid, p_vote_id uuid, p_weight smallint)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_weight = 0 then true  -- consultivo: cualquier registered+ (ya filtrado por rol authenticated)
    when p_weight = 1 then (
      select
        public.is_active_member_since(p_user, interval '3 months')
        and (
          v.scope = 'department'
          or (v.scope = 'manifesto' and public.is_verified(p_user))
        )
      from public.votes v
      where v.id = p_vote_id
    )
    else false
  end;
$$;

comment on function public.ballot_eligible(uuid, uuid, smallint) is
  'C2: elegibilidad de voto vinculante comprobada contra members/profiles en BD en el momento del INSERT, no contra el claim level del JWT.';

-- ============================================================================
-- Sellado de reglas al abrir (I6)
-- ============================================================================

create or replace function public.votes_protect_sealed_rules()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if now() >= old.opens_at and (
    new.quorum is distinct from old.quorum or
    new.threshold is distinct from old.threshold or
    new.opens_at is distinct from old.opens_at or
    new.scope is distinct from old.scope or
    new.proposal_id is distinct from old.proposal_id
  ) then
    raise exception 'quorum/threshold/opens_at/scope quedan sellados una vez abierta la votación (I6)';
  end if;
  return new;
end;
$$;

create trigger votes_protect_sealed_rules_trg
  before update on public.votes
  for each row execute function public.votes_protect_sealed_rules();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.votes enable row level security;
alter table public.ballots enable row level security;

-- votes: lectura pública (reglas publicadas de antemano); abrir: admin, o coordinator
-- solo para scope='department' (manifiesto=admin, cambia núcleo del partido).
create policy votes_select_public
  on public.votes for select
  to anon, authenticated
  using (true);

create policy votes_insert_admin_or_coordinator
  on public.votes for insert
  to authenticated
  with check (
    public.is_admin()
    or (public.is_coordinator() and scope = 'department')
  );

create policy votes_update_admin_or_coordinator
  on public.votes for update
  to authenticated
  using (public.is_admin() or (public.is_coordinator() and scope = 'department'))
  with check (public.is_admin() or (public.is_coordinator() and scope = 'department'));

-- ballots: D-001, lectura pública nominal. Escritura: solo INSERT, propio voto, ventana
-- abierta, y elegibilidad C2. Sin UPDATE ni DELETE (nadie, ni admin): un voto emitido es
-- inmutable.
create policy ballots_select_public
  on public.ballots for select
  to anon, authenticated
  using (true);

create policy ballots_insert_self_eligible
  on public.ballots for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.vote_is_open(vote_id)
    and public.ballot_eligible(auth.uid(), vote_id, weight)
  );

commit;
