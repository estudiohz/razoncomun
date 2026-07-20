-- PROPUESTA de rc-03-auth (Ola 2) para su adopción formal por rc-02-datos como
-- supabase/migrations/0016_auth_claims_and_mfa.sql. NO se ha copiado a
-- supabase/migrations/ porque ese directorio es propiedad exclusiva de
-- rc-02-datos (docs/tecnico/revision-seguridad.md, C3; instrucción explícita
-- del arranque de Ola 2: "Esquema fijado por rc-02-datos... si necesitas un
-- cambio, pídemelo en el informe").
--
-- NO aplicado por rc-03-auth (a propósito: el esquema es propiedad exclusiva
-- de rc-02-datos). Los guards de este agente (apps/web/src/lib/auth/niveles.ts)
-- funcionan HOY sin esta migración: llaman a is_admin()/is_editor() por RPC
-- (ya expuestas por PostgREST, comprobado con curl) y consultan `positions`
-- directamente (lectura pública). Esta migración es una MEJORA DE RENDIMIENTO
-- propuesta (evita 2-3 round-trips por navegación metiendo esos mismos datos
-- como claims en el JWT) — no un bloqueante. Queda para que rc-02/el arquitecto
-- la valore y, si la adopta, la numere como supabase/migrations/0016_....sql.
-- No modifica ninguna tabla existente ni sus políticas RLS: añade dos
-- funciones nuevas y los grants correspondientes.
--
-- Qué hace:
-- 1. requires_mfa(uuid): true si el usuario tiene un cargo vigente en `positions`
--    o rol admin/editor (I5, revision-seguridad.md). La usa el middleware de
--    Next.js (src/middleware.ts) para exigir aal2 antes de servir /admin.
-- 2. custom_access_token_hook(jsonb): el "Custom Access Token (Auth) Hook" de
--    Supabase — añade los claims `level`, `privacy_consent`, `is_admin`,
--    `is_editor`, `requires_mfa` al JWT. Recordatorio grabado (C2): estos
--    claims son SOLO para UX (mostrar/ocultar botones, af); ningún guard
--    crítico de este agente confía en ellos — todos re-consultan profiles/
--    members/positions en BD (ver apps/web/src/lib/auth/niveles.ts).
--
-- Para que GoTrue empiece a LLAMAR al hook hace falta además (fuera del
-- alcance de este agente, ver AUTH-SETUP.md §5): añadir en
-- infra/docker-compose.supabase.yml, servicio `auth`:
--   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED: "true"
--   GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI: "pg-functions://postgres/public/custom_access_token_hook"
-- y redesplegar el servicio en Dokploy. Sin ese paso, las funciones existen
-- en BD pero nadie las invoca todavía — no rompe nada, es aditivo y reversible.

begin;

create or replace function public.requires_mfa(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_admin(p_user)
    or public.is_editor(p_user)
    or exists (
      select 1 from public.positions p
      where p.user_id = p_user and p.ended_at is null
    );
$$;

comment on function public.requires_mfa(uuid) is
  'I5 (revision-seguridad.md): true si el usuario tiene cargo vigente o rol admin/editor. '
  'Úsalo el middleware para exigir aal2 antes de /admin. No sustituye la comprobación '
  'de aal en el propio JWT (auth.mfa.getAuthenticatorAssuranceLevel), es el complemento '
  '"a quién se le exige" — el "si ya lo tiene activo" lo da el JWT estándar de Supabase.';

grant execute on function public.requires_mfa(uuid) to authenticated;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_user_id uuid;
  v_level text;
  v_privacy_consent boolean;
  v_is_admin boolean;
  v_is_editor boolean;
  v_requires_mfa boolean;
begin
  v_user_id := (event->>'user_id')::uuid;
  claims := coalesce(event->'claims', '{}'::jsonb);

  select p.level, (p.privacy_consent_at is not null)
    into v_level, v_privacy_consent
    from public.profiles p
    where p.id = v_user_id;

  v_is_admin := public.is_admin(v_user_id);
  v_is_editor := public.is_editor(v_user_id);
  v_requires_mfa := public.requires_mfa(v_user_id);

  claims := jsonb_set(claims, '{level}', to_jsonb(coalesce(v_level, 'registered')));
  claims := jsonb_set(claims, '{privacy_consent}', to_jsonb(coalesce(v_privacy_consent, false)));
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(coalesce(v_is_admin, false)));
  claims := jsonb_set(claims, '{is_editor}', to_jsonb(coalesce(v_is_editor, false)));
  claims := jsonb_set(claims, '{requires_mfa}', to_jsonb(coalesce(v_requires_mfa, false)));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function public.custom_access_token_hook(jsonb) is
  'Custom Access Token Hook de GoTrue. Los claims que añade son SOLO para UX '
  '(C2, revision-seguridad.md) — nunca la única comprobación en una operación crítica.';

-- Solo el rol de autenticación de Supabase puede invocarlo. Nadie más (ni
-- authenticated ni anon) debe poder llamarlo directamente: recibiría el
-- jsonb "event" crudo, que no es su uso previsto.
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

commit;
