-- 0020_fix_c1_verificacion.sql
--
-- 🔴 CORRIGE C-1 (crítico de seguridad, hallazgo de rc-10 en la Ola 4).
--
-- BYPASS: la política `profiles_update_own` permitía al usuario escribir su
-- propia fila con `with_check (id = auth.uid())` SIN restricción de columnas.
-- Solo `level` estaba protegido por trigger. Los campos `identity_verified_at`
-- y `member_since` quedaban escribibles por el propio usuario, y como
-- `is_verified()` lee `profiles.identity_verified_at IS NOT NULL`, un afiliado
-- NO verificado podía:
--   PATCH /rest/v1/profiles {identity_verified_at: <ahora>}  -> 200
--   -> is_verified() = true
--   -> emitir voto vinculante de manifiesto sin pasar Stripe Identity.
-- Reproducido end-to-end por rc-10 y confirmado por el orquestador.
-- Rompe el punto 8 del manifiesto ("voto blindado") desde dentro.
--
-- CAUSA DE FONDO: el mismo error de razonamiento que persiguió a D-009 —
-- proteger SOLO donde se supone que está el riesgo (`level`) en vez de todas
-- las columnas de confianza. `identity_verified_at` y `member_since` son
-- estado que solo el webhook (Stripe Identity / Stripe Billing) tiene derecho
-- a fijar, exactamente igual que `level`.
--
-- FIX: se generaliza el trigger de `level` para blindar las TRES columnas de
-- confianza a la vez. Escritura permitida solo cuando no hay contexto JWT de
-- usuario final (service_role / webhook / migración / Studio).

begin;

create or replace function public.profiles_protect_level()
returns trigger
language plpgsql as $$
declare
  es_servicio boolean := coalesce(auth.role(), 'service_role') = 'service_role';
begin
  -- Columnas que solo el rol de servicio (webhooks de Stripe) puede fijar.
  -- Un usuario final con JWT anon/authenticated NO puede tocar ninguna:
  --   level                -> nivel de acceso (escalada de privilegios)
  --   identity_verified_at -> gobierna is_verified() -> elegibilidad de voto (C-1)
  --   member_since         -> gobierna la antigüedad -> elegibilidad de voto
  if not es_servicio then
    if new.level is distinct from old.level then
      raise exception 'profiles.level solo puede modificarse por el rol de servicio (webhook)';
    end if;
    if new.identity_verified_at is distinct from old.identity_verified_at then
      raise exception 'profiles.identity_verified_at solo lo fija el webhook de Stripe Identity (C-1)';
    end if;
    if new.member_since is distinct from old.member_since then
      raise exception 'profiles.member_since solo lo fija el webhook de afiliación';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.profiles_protect_level() is
  'Blinda level, identity_verified_at y member_since frente a escritura del '
  'propio usuario: solo el rol de servicio (webhooks Stripe) las fija. '
  'Generalizado en 0020 para cerrar C-1 (auto-verificación de identidad).';

commit;
