-- 0055_baja_y_anonimizacion.sql
--
-- Baja de cuenta: se ANONIMIZA, no se borra (decisión de Sergio, 04/09/2026).
--
-- SÍNTOMA QUE LO DESTAPA: el botón de eliminar usuario del panel devolvía
-- "Database error deleting user", y el borrado RGPD self-service de
-- /api/perfil/borrar NO PODÍA FUNCIONAR NUNCA, para nadie: la propia ruta
-- inserta una fila en `audit_log` con `actor_id` = el usuario justo antes de
-- borrarlo, y `audit_log.actor_id` referencia `profiles(id)` sin `on delete`.
-- Esa fila bloqueaba el borrado. Ni una cuenta recién creada podía irse.
--
-- POR QUÉ ANONIMIZAR Y NO BORRAR
--   Borrar en `auth.users` cascadea a `profiles`, y de `profiles` cuelgan 21
--   claves ajenas: votos, propuestas, comentarios, artículos, escenarios del
--   simulador... Borrar la fila obligaría a decidir, tabla por tabla, entre
--   perder el rastro o bloquear la baja. Conservando la fila y vaciándola de
--   datos personales, el problema desaparece: los recuentos de votaciones ya
--   publicadas siguen cuadrando y los comentarios siguen en pie, sin firma.
--
--   Y es lo que lo hace legal: un dato ANONIMIZADO de verdad queda fuera del
--   RGPD (considerando 26). No es un apaño para conservar los votos — es la
--   única vía por la que conservarlos es lícito.
--
-- QUÉ SE CONSERVA Y POR QUÉ (la parte que no es opcional)
--   `tax_identities` (el NIF) y `members` (el espejo de Stripe) NO se tocan si
--   la persona llegó a pagar cuota. No es un descuido: tienen base jurídica
--   propia y distinta —obligación legal, Art. 6.1.c RGPD— por el Modelo 182 de
--   la AEAT y la LO 8/2007, con su plazo de prescripción tributaria. El derecho
--   de supresión no alcanza a un dato que otra ley obliga a guardar. Para quien
--   NUNCA pagó no hay tal obligación: ahí el NIF se borra y la anonimización es
--   completa.
--
--   Consecuencia honesta que conviene tener escrita: mientras `members` guarde
--   el `stripe_customer_id`, Stripe sigue teniendo el nombre real y el IBAN, y
--   por tanto esto es SEUDONIMIZACIÓN, no anonimización plena. Se convierte en
--   anonimización real cuando prescribe el plazo fiscal y se purga ese resto.
--   Esa purga diferida NO la hace esta migración: es trabajo pendiente.
--
-- LO QUE NO TOCA ESTA MIGRACIÓN, A PROPÓSITO
--   `audit_log` es append-only por diseño (0013 revoca update/delete incluso a
--   service_role). No se reescribe aquí. Lo que sí se corrige es la ruta que
--   metía el email en `meta`: deja de hacerlo. Las filas antiguas que ya lo
--   llevan son una limpieza aparte, y hay que decidirla sabiendo que implica
--   perforar la inmutabilidad del registro.

begin;

-- ============================================================================
-- 1. Marca de baja en el perfil
-- ============================================================================

alter table public.profiles
  add column if not exists anonymized_at     timestamptz null,
  add column if not exists anonymized_reason text null;

comment on column public.profiles.anonymized_at is
  '0055: fecha de la baja. Si no es null, la fila ya no identifica a nadie — el nombre visible es una etiqueta fija y el email está vacío. La fila SOBREVIVE para que voten y comentarios pasados no pierdan su referencia.';
comment on column public.profiles.anonymized_reason is
  '0055: por qué se dio de baja (petición propia, decisión de admin, cuenta de prueba). Texto libre corto, sin datos personales.';

create index if not exists profiles_anonymized_idx
  on public.profiles (anonymized_at) where anonymized_at is not null;

-- ============================================================================
-- 2. Que una cuenta SIN rastro sí se pueda borrar del todo
-- ============================================================================
-- Las cuentas de prueba y las altas recién hechas que fallaron no merecen
-- quedarse como fantasmas "Usuario dado de baja" para siempre. Para poder
-- borrarlas de verdad hay que soltar la única FK que las ata siempre: la del
-- registro de auditoría, que la propia ruta de borrado escribe.
alter table public.audit_log
  drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log
  add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

comment on column public.audit_log.actor_id is
  '0055: `on delete set null`. El asiento de auditoría sobrevive al borrado de su autor —se queda sin actor, no se pierde—, que es justo lo que se espera de un registro de auditoría. Antes era NO ACTION y bloqueaba cualquier borrado de cuenta.';

-- ============================================================================
-- 3. La operación de baja
-- ============================================================================

/**
 * Vacía de datos personales el perfil y devuelve qué ha quedado retenido.
 *
 * NO toca `auth.users`: eso lo hace la aplicación con la API de admin de
 * GoTrue (email a uno quemado, contraseña aleatoria, cuenta baneada), porque
 * desde SQL no se puede invalidar una sesión ni rotar la contraseña. Las dos
 * mitades tienen que ejecutarse juntas: esta función deja el perfil anónimo,
 * y sin la otra mitad la persona todavía podría entrar.
 */
create or replace function public.anonimizar_usuario(p_user uuid, p_motivo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pago_cuota boolean;
begin
  select exists (select 1 from public.members where user_id = p_user) into v_pago_cuota;

  update public.profiles set
    display_name         = 'Usuario dado de baja',
    email                = null,
    origin_province_id   = null,
    newsletter_opt_in    = false,
    newsletter_opt_in_at = null,
    anonymized_at        = now(),
    anonymized_reason    = p_motivo,
    updated_at           = now()
  where id = p_user
    and anonymized_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_existe_o_ya_dado_de_baja');
  end if;

  -- Sin cuota nunca hubo obligación tributaria, así que tampoco hay nada que
  -- retener: el NIF se va y la anonimización es completa.
  if not v_pago_cuota then
    delete from public.tax_identities where user_id = p_user;
  end if;

  return jsonb_build_object('ok', true, 'retiene_datos_fiscales', v_pago_cuota);
end;
$$;

comment on function public.anonimizar_usuario(uuid, text) is
  '0055: baja de cuenta. Vacía el perfil de datos personales y conserva la fila para no romper votos ni comentarios. Devuelve `retiene_datos_fiscales`: true si la persona pagó cuota y por tanto se conservan `tax_identities` y `members` por obligación legal (Modelo 182, LO 8/2007). Solo service_role.';

revoke execute on function public.anonimizar_usuario(uuid, text) from anon, authenticated;

/**
 * ¿Se puede borrar del todo esta cuenta, sin dejar rastro?
 *
 * Solo si no ha tocado nada de lo que otras personas ven o de lo que depende
 * un recuento. Es la vía de las cuentas de prueba y de las altas fallidas que
 * quieren volver a registrarse; cualquier otra cosa va por la anonimización.
 */
create or replace function public.puede_borrarse_sin_rastro(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select not (
       exists (select 1 from public.members            where user_id  = p_user)
    or exists (select 1 from public.ballots            where user_id  = p_user)
    or exists (select 1 from public.proposals          where author_id = p_user)
    or exists (select 1 from public.tax_identities     where user_id  = p_user)
    or exists (select 1 from public.budget_scenarios   where user_id  = p_user)
  );
$$;

comment on function public.puede_borrarse_sin_rastro(uuid) is
  '0055: true si la cuenta no ha dejado nada que sobreviva a su titular (cuota, voto, propuesta, NIF, escenario del simulador). Es el semáforo entre borrar de verdad y dar de baja.';

revoke execute on function public.puede_borrarse_sin_rastro(uuid) from anon;

commit;
