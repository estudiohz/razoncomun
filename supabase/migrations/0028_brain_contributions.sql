-- 0028_brain_contributions.sql
-- Contribuciones ciudadanas al cerebro (docs/tecnico/cerebro-participativo.md,
-- piezas B y C). Un usuario REGISTRADO, tras una respuesta del chat, pulsa
-- "Complementa esta información" y aporta una corrección o un dato. La
-- contribución entra en cola (status='nueva'), la IA la triA (status='triaged'
-- con ai_triage), y un ADMIN la revisa (acepta/rechaza/fusiona). NADA toca el
-- corpus automáticamente: la IA prioriza y filtra, el humano decide (D-CP-5).

begin;

do $$ begin
  create type public.brain_contrib_status as enum
    ('nueva', 'triaged', 'aceptada', 'rechazada', 'fusionada');
exception when duplicate_object then null; end $$;

create table if not exists public.brain_contributions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  -- Autor: siempre un usuario registrado (D-CP-4). Referencia a profiles (como
  -- brain_entries.author_id) para poder embeber el nombre en el panel; y
  -- profiles.id = auth.uid(), así la policy insert-own sigue cuadrando. on
  -- delete set null para no perder la contribución si la cuenta se borra.
  author_id        uuid references public.profiles(id) on delete set null,
  session_id       text,
  -- Contexto del turno del chat: { pregunta, respuesta, sources }.
  turn             jsonb not null default '{}'::jsonb,
  related_entry_id uuid references public.brain_entries(id) on delete set null,
  body             text not null,
  claimed_wrong    text,
  claimed_right    text,
  source_url       text,
  status           public.brain_contrib_status not null default 'nueva',
  -- Salida del clasificador (categoria, severidad, accionable, resumen…).
  ai_triage        jsonb,
  ai_triaged_at    timestamptz,
  reviewer_id      uuid references public.profiles(id) on delete set null,
  reviewed_at      timestamptz,
  resolution_note  text
);

create index if not exists brain_contributions_cola_idx
  on public.brain_contributions (status, created_at desc);

alter table public.brain_contributions enable row level security;

-- Un usuario registrado puede CREAR su propia contribución (author_id = él).
-- No puede leer ni tocar las de nadie: la cola es solo para editores/admin.
drop policy if exists brain_contributions_insert_own on public.brain_contributions;
create policy brain_contributions_insert_own
  on public.brain_contributions
  for insert to authenticated
  with check (author_id = auth.uid());

-- Editores/admin (is_editor, misma función que el resto del cerebro) gestionan
-- la cola: leer, actualizar (aceptar/rechazar) y borrar.
drop policy if exists brain_contributions_select_editor on public.brain_contributions;
create policy brain_contributions_select_editor
  on public.brain_contributions
  for select to authenticated
  using (public.is_editor());

drop policy if exists brain_contributions_update_editor on public.brain_contributions;
create policy brain_contributions_update_editor
  on public.brain_contributions
  for update to authenticated
  using (public.is_editor())
  with check (public.is_editor());

drop policy if exists brain_contributions_delete_editor on public.brain_contributions;
create policy brain_contributions_delete_editor
  on public.brain_contributions
  for delete to authenticated
  using (public.is_editor());

comment on table public.brain_contributions is
  'Contribuciones ciudadanas al cerebro (piezas B/C). El usuario registrado aporta desde el chat; la IA triA (ai_triage); el admin revisa. Nada entra al corpus sin aprobación humana.';

commit;
