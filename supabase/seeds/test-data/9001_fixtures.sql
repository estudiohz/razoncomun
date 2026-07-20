-- 9001_fixtures.sql
-- ⚠️⚠️⚠️ NUNCA EJECUTAR EN PRODUCCIÓN ⚠️⚠️⚠️
-- Usuarios ficticios para que Auth (rc-03) y QA (rc-10) prueben RLS por nivel. Ningún dato
-- real de personas (repo público, revision-seguridad.md C5). Crea filas en auth.users
-- directamente (sin contraseña real utilizable) SOLO para poder emitir JWTs de prueba
-- firmados con el JWT_SECRET del entorno y ejercitar cada política de RLS end-to-end.
--
-- Cobertura de niveles (uno por fila, ids fijos para poder referenciarlos desde el script
-- de pruebas RLS):
--   ...101 registered_user   -> registered, sin afiliación
--   ...102 member_new        -> member activo, alta hace 1 mes (< 3 meses, NO vota vinculante)
--   ...103 member_old        -> member activo, alta hace 6 meses (>= 3 meses, SÍ vota vinculante departamento)
--   ...104 member_verified   -> member activo >=3 meses + level=verified (vota también manifiesto)
--   ...105 editor_user       -> app_role 'editor'
--   ...106 admin_user        -> app_role 'admin'
--   ...107 coordinator_user  -> cargo orgánico coordinator (scope community)
--   ...108 member_canceled   -> member con status='canceled' (para probar rechazo)
--
-- Password de todos (si algún día se necesita login real vía GoTrue): "Test1234!" — SOLO
-- entorno de desarrollo, nunca reutilizar. encrypted_password aquí es un hash bcrypt de esa
-- cadena generado con crypt()/pgcrypto, no un valor inventado.

begin;

-- Idempotencia: si este fixture ya se cargó antes (p.ej. tras resetear solo el esquema
-- public sin tocar auth.users), se limpia primero. El ON DELETE CASCADE de profiles se
-- encarga de members/positions/user_app_roles/etc.
delete from auth.users where email like '%@razoncomun.invalid';

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('11111111-1111-1111-1111-111111111101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'registered.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"registered_user"}', now(), now()),
  ('11111111-1111-1111-1111-111111111102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member.new.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"member_new"}', now(), now()),
  ('11111111-1111-1111-1111-111111111103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member.old.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"member_old"}', now(), now()),
  ('11111111-1111-1111-1111-111111111104', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member.verified.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"member_verified"}', now(), now()),
  ('11111111-1111-1111-1111-111111111105', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'editor.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"editor_user"}', now(), now()),
  ('11111111-1111-1111-1111-111111111106', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"admin_user"}', now(), now()),
  ('11111111-1111-1111-1111-111111111107', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'coordinator.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"coordinator_user"}', now(), now()),
  ('11111111-1111-1111-1111-111111111108', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'member.canceled.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
   now(), '{"provider":"email"}', '{"fixture":"member_canceled"}', now(), now())
on conflict (id) do nothing;

-- ⚠️ OBLIGATORIO tras insertar en auth.users a mano (ver D-011 en
-- docs/tecnico/decisiones-construccion.md).
-- GoTrue está escrito en Go y mapea estas columnas a `string` NO anulable. Si
-- quedan en NULL —que es lo que ocurre al no incluirlas en el INSERT de
-- arriba— el escaneo de filas falla y `GET /auth/v1/admin/users` devuelve
-- 500 "Database error finding users", bloqueando cualquier panel que liste
-- usuarios (rc-09-admin). El fallo pasa desapercibido porque `getUserById`
-- sigue devolviendo 200: solo revienta al LISTAR.
-- Las altas reales creadas por GoTrue ya traen '' por defecto; esto solo hace
-- falta para filas insertadas directamente por un seed.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where email like '%@razoncomun.invalid';

-- El trigger on_auth_user_created ya debería haber creado las filas de profiles; este
-- INSERT defensivo con ON CONFLICT DO NOTHING garantiza idempotencia por si el DELETE de
-- arriba y este INSERT corren en el mismo script (incluso si el trigger no llegara a
-- disparar en algún escenario de reset parcial del esquema).
insert into public.profiles (id, email)
  select id, email from auth.users where email like '%@razoncomun.invalid'
  on conflict (id) do nothing;

-- Ajustamos niveles/afiliación/cargos de cada fixture.
update public.profiles set display_name = 'Registrado de Prueba' where id = '11111111-1111-1111-1111-111111111101';
update public.profiles set display_name = 'Afiliado Reciente de Prueba', level = 'member', member_since = now() - interval '1 month'
  where id = '11111111-1111-1111-1111-111111111102';
update public.profiles set display_name = 'Afiliado Antiguo de Prueba', level = 'member', member_since = now() - interval '6 months'
  where id = '11111111-1111-1111-1111-111111111103';
update public.profiles set display_name = 'Afiliado Verificado de Prueba', level = 'verified', member_since = now() - interval '6 months', identity_verified_at = now() - interval '5 months'
  where id = '11111111-1111-1111-1111-111111111104';
update public.profiles set display_name = 'Editor de Prueba' where id = '11111111-1111-1111-1111-111111111105';
update public.profiles set display_name = 'Admin de Prueba' where id = '11111111-1111-1111-1111-111111111106';
update public.profiles set display_name = 'Coordinador de Prueba' where id = '11111111-1111-1111-1111-111111111107';
update public.profiles set display_name = 'Afiliado Cancelado de Prueba', level = 'member', member_since = now() - interval '6 months'
  where id = '11111111-1111-1111-1111-111111111108';

-- NOTA: el UPDATE de profiles.level de arriba lo ejecuta este script como rol de servicio
-- (postgres/service_role), que es precisamente el único rol autorizado por el trigger
-- profiles_protect_level (0003_identity.sql) para tocar esa columna.

insert into public.members (user_id, status, billing_period, amount_cents, payment_method, sepa_mandate_id, started_at) values
  ('11111111-1111-1111-1111-111111111102', 'active', 'monthly', 500, 'sepa_debit', 'MANDATE-TEST-102', now() - interval '1 month'),
  ('11111111-1111-1111-1111-111111111103', 'active', 'monthly', 500, 'sepa_debit', 'MANDATE-TEST-103', now() - interval '6 months'),
  ('11111111-1111-1111-1111-111111111104', 'active', 'monthly', 500, 'sepa_debit', 'MANDATE-TEST-104', now() - interval '6 months'),
  ('11111111-1111-1111-1111-111111111108', 'canceled', 'monthly', 500, 'sepa_debit', 'MANDATE-TEST-108', now() - interval '6 months');

update public.members set canceled_at = now() - interval '1 day' where user_id = '11111111-1111-1111-1111-111111111108';

insert into public.user_app_roles (user_id, role_id)
  select '11111111-1111-1111-1111-111111111105', id from public.app_roles where key = 'editor';
insert into public.user_app_roles (user_id, role_id)
  select '11111111-1111-1111-1111-111111111106', id from public.app_roles where key = 'admin';

insert into public.positions (user_id, role, scope, territory_id)
  select '11111111-1111-1111-1111-111111111107', 'coordinator', 'community',
    (select id from public.territories where type = 'community' and name = 'Madrid, Comunidad de');

commit;
