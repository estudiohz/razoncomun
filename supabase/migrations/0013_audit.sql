-- 0013_audit.sql
-- Auditoría (I6, revision-seguridad.md): append-only de verdad. RLS por sí sola NO basta
-- para bloquear UPDATE/DELETE porque `service_role` tiene BYPASSRLS (rolbypassrls=true) y
-- las políticas RLS no le aplican. Por eso además de RLS se hace REVOKE explícito de
-- UPDATE/DELETE/TRUNCATE a nivel de privilegios de tabla para anon, authenticated Y
-- service_role — "revocar UPDATE/DELETE incluso al rol servicio", tal cual pide el brief.

begin;

create table public.audit_log (
  id          uuid primary key default extensions.gen_random_uuid(),
  actor_id    uuid null references public.profiles(id),
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log(entity, entity_id);
create index audit_log_actor_idx on public.audit_log(actor_id);
create index audit_log_created_at_idx on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Lectura: solo admin (panel interno de auditoría).
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- Inserción: cualquier autenticado puede registrar SU propia acción (actor_id = auth.uid());
-- el registro de acciones de sistema/servicio se hace vía service_role, que bypassa RLS.
create policy audit_log_insert_own_or_system
  on public.audit_log for insert
  to authenticated
  with check (actor_id = auth.uid() or actor_id is null);

-- Append-only real: revocar UPDATE/DELETE/TRUNCATE a TODOS los roles de aplicación,
-- incluido service_role (I6 lo pide explícitamente porque service_role bypassa RLS).
revoke update, delete, truncate on public.audit_log from anon;
revoke update, delete, truncate on public.audit_log from authenticated;
revoke update, delete, truncate on public.audit_log from service_role;

commit;
