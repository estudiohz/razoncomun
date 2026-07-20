-- 0022_tax_identities.sql
--
-- NIF/DNI de los afiliados, para el Modelo 182 y el certificado fiscal (D-020).
--
-- Decisión de Sergio: el NIF se pide **en la afiliación**, nunca en el registro.
-- Un usuario que solo se registra (Google/Facebook/email) para el Discord, dar
-- likes o hacer sugerencias NO da NIF — no hay base legal para pedírselo. El NIF
-- nace con la cuota, que es cuando aparece la obligación tributaria.
--
-- DISEÑO (propuesto por rc-02, opción A — consistencia con `members`):
--   Tabla SEPARADA de `profiles`, no una columna. `profiles` es la tabla más
--   leída del sistema; sacar el identificador nacional a su propia tabla acota
--   el radio de exposición y permite RLS/retención propias. Mismo patrón que
--   `members` es un espejo separado de Stripe.
--
--   NIF en claro, protegido por RLS (propia + tesorería/admin) y por los backups
--   cifrados con age (C4). Es un identificador personal estándar, NO categoría
--   especial del Art. 9 (eso ya lo cubre la afiliación política en sí). Se trata
--   igual que `members.sepa_mandate_id`. Reversible a cifrado pgcrypto (opción B)
--   si la asesoría lo exige — es un ALTER localizado.
--
-- BASE JURÍDICA: obligación legal (Art. 6.1.c RGPD) — el Modelo 182 de la AEAT
-- y la LO 8/2007 exigen identificar con NIF a quien recibe deducción fiscal por
-- su cuota a un partido. Base distinta y más simple que el consentimiento del
-- Art. 9 ya recogido para la afiliación.
--
-- Cambio del orquestador sobre la zona de rc-02-datos (dueño del esquema),
-- ejecutando su propio diseño.

begin;

create table if not exists public.tax_identities (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  tax_id          text not null,
  -- Cómo se validó el formato/identidad del NIF: 'declared' (autodeclarado en
  -- el alta) o 'stripe_identity' (verificado con documento). Voto vinculante
  -- exige el segundo (D-017); el certificado fiscal se conforma con el primero.
  verified_method text not null default 'declared'
    check (verified_method in ('declared', 'stripe_identity')),
  verified_at     timestamptz null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Formato NIF/NIE español básico: 8 dígitos + letra, o X/Y/Z + 7 dígitos +
  -- letra. La validez del dígito de control la comprueba la aplicación; esto
  -- solo evita basura evidente en la BD.
  constraint tax_id_formato_chk check (tax_id ~ '^[0-9XYZ][0-9]{7}[A-Z]$')
);

comment on table public.tax_identities is
  'NIF/DNI de afiliados (D-020). Tabla separada de profiles para acotar la '
  'exposición del identificador nacional. Base jurídica: obligación legal '
  'tributaria (Modelo 182 / LO 8/2007), NO Art. 9. Se pide en la afiliación, '
  'nunca en el registro.';

create trigger tax_identities_set_updated_at
  before update on public.tax_identities
  for each row execute function public.set_updated_at();

alter table public.tax_identities enable row level security;

-- Lectura: la propia persona, o tesorería/admin (mismo patrón que members).
drop policy if exists tax_identities_select_own_or_finance on public.tax_identities;
create policy tax_identities_select_own_or_finance on public.tax_identities
  for select to authenticated
  using (user_id = auth.uid() or public.is_treasurer(auth.uid()) or public.is_admin(auth.uid()));

-- Alta: la propia persona en su afiliación (su fila). La verificación por
-- documento (verified_method='stripe_identity', verified_at) la fija SOLO el
-- servicio vía webhook — ver trigger de protección más abajo.
drop policy if exists tax_identities_insert_own on public.tax_identities;
create policy tax_identities_insert_own on public.tax_identities
  for insert to authenticated
  with check (user_id = auth.uid());

-- Actualización del propio NIF por la persona (corregir un typo antes de
-- verificar). Bloqueada una vez verificado por documento.
drop policy if exists tax_identities_update_own on public.tax_identities;
create policy tax_identities_update_own on public.tax_identities
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- El estado de verificación por documento solo lo fija el rol de servicio
-- (webhook de Stripe Identity), nunca el propio usuario — mismo criterio que
-- profiles.identity_verified_at (C-1).
create or replace function public.tax_identities_protect_verification()
returns trigger language plpgsql security definer set search_path = public as $$
declare es_servicio boolean := coalesce(auth.role(), 'service_role') = 'service_role';
begin
  if not es_servicio then
    if new.verified_method is distinct from old.verified_method
       or new.verified_at is distinct from old.verified_at then
      raise exception 'La verificación documental del NIF solo la fija el webhook de Stripe Identity';
    end if;
  end if;
  return new;
end;
$$;

create trigger tax_identities_protect_verification_trg
  before update on public.tax_identities
  for each row execute function public.tax_identities_protect_verification();

commit;
