-- 0067 · Fecha real de publicación de una propuesta.
--
-- La ficha pública decía "Publicada el <created_at>", y created_at es cuándo
-- NACIÓ la propuesta. Un borrador del RC-bot que se revisa semanas después
-- salía "publicada" en la fecha en que el bot lo creó, no en la que alguien lo
-- publicó. published_at es la primera vez que la propuesta dejó de ser borrador;
-- lo rellena un trigger (como adopted_at, 0061) y no se edita a mano.
--
-- Las propuestas que ya estaban publicadas conservan created_at: es la mejor
-- aproximación disponible, y para las que nacieron publicadas es exacta.

alter table public.proposals
  add column published_at timestamptz null;

comment on column public.proposals.published_at is
  'Primera vez que la propuesta salió de draft (o nació publicada). Null mientras es borrador. Lo rellena el trigger.';

update public.proposals
   set published_at = created_at
 where status <> 'draft' and published_at is null;

create or replace function public.proposals_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'draft' then
    new.published_at := null;
  elsif tg_op = 'INSERT' then
    new.published_at := coalesce(new.published_at, now());
  elsif old.status = 'draft' then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  return new;
end;
$$;

create trigger proposals_set_published_at_trg
  before insert or update on public.proposals
  for each row execute function public.proposals_set_published_at();
