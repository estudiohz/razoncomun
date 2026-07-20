-- 0016_ai_provider_credentials.sql
-- Alcance NUEVO fuera del plan original (D-016, docs/tecnico/decisiones-construccion.md):
-- gestión desde el panel admin de las API keys de los proveedores de IA (Anthropic, OpenAI,
-- Google) que usa RC-Brain para llamar al LLM sobre el corpus interno. UN SOLO proveedor
-- activo a la vez ("simple, y una sola voz del partido").
--
-- Modelo de amenaza explícito: un volcado robado de Postgres (pg_dump) circula mucho más
-- fácil que el servidor en vivo. Por eso:
--   1. La clave del proveedor se guarda CIFRADA con pgcrypto (pgp_sym_encrypt/pgp_sym_decrypt).
--   2. La CLAVE MAESTRA de cifrado NUNCA se guarda en la base. Vive solo en el entorno de la
--      app (ej. process.env.AI_CREDENTIALS_MASTER_KEY en el server de Next.js) y se pasa como
--      PARÁMETRO en cada llamada a las funciones de esta migración. Un dump de esta tabla sin
--      la clave del entorno es inútil: solo bytea cifrado.
--   3. Solo `service_role` puede tocar esta tabla: RLS activada SIN ninguna policy (mismo
--      patrón que brain_documents en 0012) + REVOKE explícito de privilegios a anon/authenticated
--      (mismo patrón defensivo que audit_log en 0013 — no fiarse solo de RLS).
--   4. La clave completa NUNCA se devuelve a la UI tras guardarla: se guarda por separado un
--      sufijo en claro (key_suffix, últimos 4 caracteres) que el admin puede leer sin descifrar
--      nada. Solo la función ai_credentials_get_active() descifra, y solo la debe llamar el
--      backend en el momento exacto de invocar al LLM, nunca para responder a una petición
--      de la UI.
--   5. Cambiar de proveedor dispara la suite de neutralidad (ai_evals, 0014_participation_extra
--      ya la crea). Si el resultado cae por debajo del 95%, se revierte automáticamente al
--      proveedor anterior: por eso cada fila activada guarda `previous_credential_id`, lo que
--      permite deshacer sin volver a pedir la clave (no hace falta la clave maestra para
--      revertir: solo se cambia qué fila está activa).

begin;

-- ============================================================================
-- TABLA
-- ============================================================================

create table public.ai_provider_credentials (
  id                      uuid primary key default extensions.gen_random_uuid(),
  provider                text not null check (provider in ('anthropic', 'openai', 'google')),
  model                   text not null,
  api_key_encrypted       bytea not null,     -- extensions.pgp_sym_encrypt(clave, clave_maestra_del_entorno)
  key_suffix              text not null,      -- últimos 4 caracteres en claro, SOLO para mostrar en la UI
  active                  boolean not null default false,
  previous_credential_id  uuid null references public.ai_provider_credentials(id),
  changed_by              uuid null references public.profiles(id),
  changed_at              timestamptz not null default now(),
  created_at              timestamptz not null default now()
);

comment on table public.ai_provider_credentials is
  'Claves de los proveedores de IA del RC-Brain, cifradas con pgcrypto. La clave maestra de '
  'cifrado vive SOLO en el entorno de la app, nunca en esta base (D-016). Solo service_role '
  'accede (RLS sin policies + REVOKE explícito). Nunca se lee la clave completa fuera de '
  'ai_credentials_get_active(), reservada a la llamada real al LLM.';

comment on column public.ai_provider_credentials.api_key_encrypted is
  'pgp_sym_encrypt(api_key, clave_maestra). La clave maestra NUNCA se persiste: se recibe como '
  'parámetro en cada llamada desde el entorno del servidor (p.ej. AI_CREDENTIALS_MASTER_KEY).';

comment on column public.ai_provider_credentials.key_suffix is
  'Últimos 4 caracteres de la clave en claro, guardados aparte para que la UI muestre '
  'identificación visual sin necesitar nunca descifrar (escritura sí, lectura de la clave no).';

comment on column public.ai_provider_credentials.previous_credential_id is
  'Fila que estaba activa justo antes de esta activación. Permite revertir (ai_credentials_revert) '
  'si la suite de neutralidad post-cambio cae por debajo del 95%, sin volver a pedir la clave.';

create index ai_provider_credentials_provider_idx on public.ai_provider_credentials(provider);

-- Garantiza "un solo proveedor activo" EN EL ESQUEMA, no confiando en la aplicación: índice
-- único parcial sobre las filas con active=true. Como todas las filas indexadas comparten el
-- mismo valor indexado (true), un segundo INSERT/UPDATE con active=true viola la unicidad.
create unique index ai_provider_credentials_single_active_uidx
  on public.ai_provider_credentials (active)
  where active;

-- ============================================================================
-- RLS: SOLO service_role (ver 0012_brain.sql para el mismo patrón)
-- ============================================================================
-- service_role tiene rolbypassrls=true (documentado en 0013_audit.sql), así que accede sin
-- necesitar ninguna policy. anon/authenticated NO tienen bypass: con RLS activada y CERO
-- policies, Postgres deniega todas las filas por defecto para esos roles. Además, igual que
-- 0013 hizo con audit_log, se revocan explícitamente los privilegios a nivel de tabla como
-- defensa en profundidad (no depender solo de RLS para un dato tan sensible).

alter table public.ai_provider_credentials enable row level security;

revoke all on public.ai_provider_credentials from anon;
revoke all on public.ai_provider_credentials from authenticated;

-- Sin policies a propósito: ni anon ni authenticated deben poder leer esta tabla, ni siquiera
-- key_suffix o las columnas no cifradas. Todo pasa por service_role desde el server.

-- ============================================================================
-- FUNCIONES (SECURITY DEFINER, ejecutables SOLO por service_role)
-- ============================================================================
-- SECURITY DEFINER es necesario para poder escribir en audit_log (append-only, I6) sin
-- depender de que auth.uid() coincida con actor_id — el propio owner de la función (postgres)
-- está exento de la RLS de audit_log, igual que el trigger de snapshot del manifiesto en
-- 0004_manifesto.sql. Para que esto no se convierta en una puerta trasera, cada función
-- comprueba auth.role() explícitamente (mismo patrón que profiles_protect_level en
-- 0003_identity.sql) Y además se revoca EXECUTE a PUBLIC/anon/authenticated a nivel de
-- privilegios, dejando el grant solo a service_role. Doble cierre: privilegio + comprobación.

create or replace function public.ai_credentials_set(
  p_provider    text,
  p_model       text,
  p_api_key     text,
  p_master_key  text,
  p_changed_by  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_id uuid;
  v_new_id  uuid;
  v_suffix  text;
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'ai_provider_credentials: solo service_role puede modificar credenciales de IA';
  end if;

  if p_provider not in ('anthropic', 'openai', 'google') then
    raise exception 'proveedor no soportado: %', p_provider;
  end if;

  if p_model is null or length(trim(p_model)) = 0 then
    raise exception 'model es obligatorio';
  end if;

  if p_api_key is null or length(trim(p_api_key)) < 8 then
    raise exception 'api_key inválida (demasiado corta o vacía)';
  end if;

  if p_master_key is null or length(p_master_key) = 0 then
    raise exception 'clave maestra requerida (nunca se guarda en BD; debe llegar del entorno de la app)';
  end if;

  select id into v_prev_id from public.ai_provider_credentials where active = true limit 1;

  update public.ai_provider_credentials set active = false where active = true;

  v_suffix := right(trim(p_api_key), 4);

  insert into public.ai_provider_credentials
    (provider, model, api_key_encrypted, key_suffix, active, previous_credential_id, changed_by, changed_at)
  values
    (p_provider, p_model, extensions.pgp_sym_encrypt(p_api_key, p_master_key), v_suffix, true, v_prev_id, p_changed_by, now())
  returning id into v_new_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    p_changed_by, 'ai_provider_activated', 'ai_provider_credentials', v_new_id,
    jsonb_build_object('provider', p_provider, 'model', p_model, 'previous_credential_id', v_prev_id)
  );

  return v_new_id;
end;
$$;

comment on function public.ai_credentials_set(text, text, text, text, uuid) is
  'Activa un nuevo proveedor de IA cifrando su clave con la clave maestra recibida como parámetro '
  '(nunca almacenada). Desactiva el anterior y guarda su id en previous_credential_id para poder '
  'revertir. SOLO service_role. Registra en audit_log.';

create or replace function public.ai_credentials_get_active(
  p_master_key text
)
returns table (
  id          uuid,
  provider    text,
  model       text,
  api_key     text,
  key_suffix  text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'ai_provider_credentials: solo service_role puede leer credenciales de IA';
  end if;

  if p_master_key is null or length(p_master_key) = 0 then
    raise exception 'clave maestra requerida';
  end if;

  return query
    select
      c.id,
      c.provider,
      c.model,
      extensions.pgp_sym_decrypt(c.api_key_encrypted, p_master_key) as api_key,
      c.key_suffix
    from public.ai_provider_credentials c
    where c.active = true
    limit 1;
end;
$$;

comment on function public.ai_credentials_get_active(text) is
  'Descifra y devuelve la clave del proveedor activo. Reservada al momento exacto de llamar al '
  'LLM desde el backend: la clave completa NUNCA debe salir en una respuesta a la UI. Con la '
  'clave maestra incorrecta, pgp_sym_decrypt lanza excepción ("Wrong key or corrupt data") en '
  'vez de devolver texto — no hay descifrado silencioso a datos erróneos.';

create or replace function public.ai_credentials_revert(
  p_reason      text default null,
  p_changed_by  uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_id uuid;
  v_prev_id   uuid;
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'ai_provider_credentials: solo service_role puede revertir credenciales de IA';
  end if;

  select id, previous_credential_id into v_active_id, v_prev_id
    from public.ai_provider_credentials where active = true limit 1;

  if v_active_id is null then
    raise exception 'no hay proveedor activo del que revertir';
  end if;

  if v_prev_id is null then
    raise exception 'el proveedor activo no tiene proveedor anterior registrado (previous_credential_id NULL)';
  end if;

  update public.ai_provider_credentials set active = false where id = v_active_id;
  update public.ai_provider_credentials
    set active = true, changed_by = coalesce(p_changed_by, changed_by), changed_at = now()
    where id = v_prev_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (
    p_changed_by, 'ai_provider_reverted', 'ai_provider_credentials', v_prev_id,
    jsonb_build_object('reverted_from', v_active_id, 'reason', p_reason)
  );

  return v_prev_id;
end;
$$;

comment on function public.ai_credentials_revert(text, uuid) is
  'Revierte al proveedor anterior (previous_credential_id de la fila activa). Pensada para que '
  'la suite de neutralidad (ai_evals, 0014) la dispare automáticamente cuando el resultado tras '
  'un cambio de proveedor cae por debajo del 95% (D-016). No necesita la clave maestra: solo '
  'cambia qué fila está marcada active.';

-- IMPORTANTE: "REVOKE ... FROM PUBLIC" NO retira privilegios ya concedidos explícitamente a
-- anon/authenticated. En este proyecto "alter default privileges ... grant all on functions to
-- anon, authenticated, service_role" (ver supabase/README.md, reaplicar en limpio) concede
-- EXECUTE a esos tres roles EN EL MOMENTO DE CREAR la función, de forma directa (no vía PUBLIC).
-- Verificado en vivo (dev-api.razoncomun.com): tras un REVOKE ... FROM PUBLIC, pg_proc.proacl
-- seguía listando anon=X y authenticated=X. Hay que revocar de cada rol explícitamente.
revoke all on function public.ai_credentials_set(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.ai_credentials_get_active(text) from public, anon, authenticated;
revoke all on function public.ai_credentials_revert(text, uuid) from public, anon, authenticated;

grant execute on function public.ai_credentials_set(text, text, text, text, uuid) to service_role;
grant execute on function public.ai_credentials_get_active(text) to service_role;
grant execute on function public.ai_credentials_revert(text, uuid) to service_role;

commit;
