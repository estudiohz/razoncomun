-- 0034_proposals_draft_y_bot.sql
-- Ola U0 del panel unificado de usuario (docs/tecnico/panel-usuario.md, D-U4/D-U5).
--
-- Dos cosas, ambas reforzadas en BD (no solo en la app):
--
--  1. Estado 'draft' en proposals. Hoy el CHECK no contempla borrador
--     (seed/deliberation/stress_test/voting/planned/adopted/discarded/archived).
--     Un draft es visible SOLO para su autor y para editores -- igual que se
--     hizo con 'archived' en 0032 (RIESGO Nº1): debe resistir un curl directo a
--     PostgREST con la anon key, no confiar en que la UI no lo pinte (misma
--     lección que C-1).
--
--  2. Las propuestas que llegan del RC-bot nacen SIEMPRE como borrador, para
--     que un editor las revise antes de que sean públicas.
--
--     Al bot NO se le identifica por UUID hardcodeado (cambiaría entre dev y
--     producción y la migración no sería portable) sino con un app_role nuevo,
--     'bot', dentro del sistema de roles que ya existe (app_roles +
--     user_app_roles + has_app_role, 0003_identity). Así el mismo SQL vale en
--     cualquier entorno y "quién es el bot" queda auditable en una tabla en vez
--     de enterrado en una constante.
--
--     El refuerzo es un trigger BEFORE INSERT que fuerza status='draft' si el
--     autor tiene el rol 'bot'. Aunque el flujo de n8n cambie, se equivoque o
--     alguien llame directamente a PostgREST con las credenciales del bot
--     pidiendo status='seed', la fila entra como borrador.
--
--     Sacar un draft de borrador sigue estando protegido por el trigger que ya
--     existía (proposals_protect_status, 0005): solo coordinator/admin cambian
--     el status. El bot no es ninguno de los dos, así que no puede publicarse a
--     sí mismo -- no hace falta nada nuevo para eso.

begin;

-- ============================================================================
-- 1. Rol 'bot' y helper is_bot()
-- ============================================================================

insert into public.app_roles (key, label)
  values ('bot', 'Bot (RC-bot)')
  on conflict (key) do nothing;

comment on function public.has_app_role(uuid, text) is
  'Helper de roles de app (0003). 0034 añade la clave "bot" al catálogo: identifica al usuario automático del RC-bot sin hardcodear su UUID.';

create or replace function public.is_bot(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_app_role(p_user, 'bot');
$$;

comment on function public.is_bot(uuid) is
  '0034: true si el usuario tiene el app_role "bot" (RC-bot). Usado por el trigger que fuerza status=draft en sus propuestas.';

-- Alta del usuario del bot en el rol, si existe en este entorno. Se resuelve
-- por email para que la migración sea idempotente y portable: en dev el bot ya
-- existe (bot@razoncomun.com); en un entorno donde todavía no exista, esto no
-- hace nada y no rompe la migración -- basta con volver a asignarle el rol
-- cuando se cree.
insert into public.user_app_roles (user_id, role_id)
select p.id, ar.id
  from public.profiles p
  cross join public.app_roles ar
 where p.email = 'bot@razoncomun.com'
   and ar.key = 'bot'
on conflict (user_id, role_id) do nothing;

-- ============================================================================
-- 2. Estado 'draft' en el CHECK de proposals
-- ============================================================================

alter table public.proposals drop constraint proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in (
    'draft', 'seed', 'deliberation', 'stress_test', 'voting',
    'planned', 'adopted', 'discarded', 'archived'
  ));

-- ============================================================================
-- 3. Visibilidad: un draft solo lo ve su autor o un editor
-- ============================================================================
-- Reemplaza la policy de 0032 (que solo filtraba 'archived'). Para anon,
-- auth.uid() es null, así que la comparación author_id = auth.uid() nunca es
-- true: un borrador no se filtra ni con la anon key.

drop policy proposals_select_public on public.proposals;

create policy proposals_select_public
  on public.proposals for select
  to anon, authenticated
  using (
    (status not in ('archived', 'draft'))
    or public.is_editor()
    or (status = 'draft' and author_id = auth.uid())
  );

comment on policy proposals_select_public on public.proposals is
  '0034: público ve todo menos archived y draft. El autor ve sus propios drafts; un editor lo ve todo. Debe resistir curl directo a PostgREST (RIESGO Nº1 de 0032, lección C-1).';

-- El autor puede seguir editando su propio borrador (antes solo seed/deliberation).
drop policy proposals_update_author_or_moderation on public.proposals;

create policy proposals_update_author_or_moderation
  on public.proposals for update
  to authenticated
  using (
    (author_id = auth.uid() and status in ('draft', 'seed', 'deliberation'))
    or public.is_coordinator() or public.is_admin()
  )
  with check (
    (author_id = auth.uid() and status in ('draft', 'seed', 'deliberation'))
    or public.is_coordinator() or public.is_admin()
  );

-- ============================================================================
-- 4. Trigger: lo que inserta el bot nace como borrador
-- ============================================================================

create or replace function public.proposals_force_draft_for_bot()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_bot(new.author_id) then
    new.status := 'draft';
  end if;
  return new;
end;
$$;

comment on function public.proposals_force_draft_for_bot() is
  '0034 (D-U5): las propuestas del RC-bot nacen siempre como borrador, pase lo que pase en la capa que las inserta. Un editor las promociona a seed desde /admin/participacion.';

create trigger proposals_force_draft_for_bot_trg
  before insert on public.proposals
  for each row execute function public.proposals_force_draft_for_bot();

-- ============================================================================
-- 5. No se puede apoyar un borrador
-- ============================================================================
-- Coherente con D-P6/D-P7: un draft todavía no es público, así que no admite
-- apoyos. Se añade a la lista de estados cerrados del trigger de 0032.

create or replace function public.proposal_supports_check_open()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
  p_status  text;
  p_deadline timestamptz;
begin
  target_id := coalesce(new.proposal_id, old.proposal_id);

  select status, deadline_at into p_status, p_deadline
    from public.proposals where id = target_id;

  if p_status is null then
    raise exception 'Propuesta % no existe', target_id;
  end if;

  if p_status in ('draft', 'adopted', 'discarded', 'archived')
     or (p_deadline is not null and p_deadline <= now()) then
    raise exception 'La votación de esta propuesta está cerrada; el apoyo no puede cambiar';
  end if;

  return coalesce(new, old);
end;
$$;

commit;
