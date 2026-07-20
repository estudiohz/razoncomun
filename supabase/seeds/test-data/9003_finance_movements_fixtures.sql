-- 9003_finance_movements_fixtures.sql
-- ⚠️⚠️⚠️ NUNCA EJECUTAR EN PRODUCCIÓN ⚠️⚠️⚠️
-- Datos de prueba para verificar RLS de finance_movements (0023_finance_movements.sql):
-- (1) un usuario ficticio con cargo orgánico 'treasurer' (no cubierto por 9001_fixtures.sql,
--     que solo tiene admin/editor/coordinator) para poder distinguir en las pruebas la rama
--     is_treasurer() de la rama is_admin() de la policy "admin/tesorería";
-- (2) movimientos de ejemplo, CON contraparte ficticia en todos ellos (publicados y no), para
--     comprobar que counterparty_name/counterparty_ref no se filtran ni siquiera en las filas
--     que sí están published=true.
--
-- Nombres/IBAN de contraparte son inventados (repo público, revision-seguridad.md C5).

begin;

delete from auth.users where email = 'treasurer.test@razoncomun.invalid';

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111109', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'treasurer.test@razoncomun.invalid', extensions.crypt('Test1234!', extensions.gen_salt('bf')),
  now(), '{"provider":"email"}', '{"fixture":"treasurer_user"}', now(), now()
) on conflict (id) do nothing;

-- Mismo saneo de columnas NOT NULL de GoTrue que 9001_fixtures.sql (D-011).
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change               = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where email = 'treasurer.test@razoncomun.invalid';

insert into public.profiles (id, email)
  select id, email from auth.users where email = 'treasurer.test@razoncomun.invalid'
  on conflict (id) do nothing;

update public.profiles set display_name = 'Tesorero de Prueba'
  where id = '11111111-1111-1111-1111-111111111109';

insert into public.positions (user_id, role, scope)
  select '11111111-1111-1111-1111-111111111109', 'treasurer', 'national'
  where not exists (
    select 1 from public.positions
    where user_id = '11111111-1111-1111-1111-111111111109' and role = 'treasurer' and ended_at is null
  );

-- Movimientos de ejemplo: limpiar carga previa de prueba por import_batch.
delete from public.finance_movements where import_batch = 'test-2026-07-wise';

insert into public.finance_movements
  (dated, description, amount_cents, direction, currency, category, counterparty_name, counterparty_ref, import_batch, source, published)
values
  (current_date - 5, 'Cuota afiliación julio', 500,  'in',  'EUR', 'cuotas',          'Ana Ejemplo Donante',      'ES9820385778983000760236', 'test-2026-07-wise', 'wise', true),
  (current_date - 4, 'Dominio razoncomun.com', 1200, 'out', 'EUR', 'infraestructura', 'NIC.ES Registry SL',       'ES1000491500051234567892', 'test-2026-07-wise', 'wise', true),
  (current_date - 3, 'Donación puntual',       2000, 'in',  'EUR', 'donaciones',      'Carlos Ejemplo Donante',   'ES7620770024003102575766', 'test-2026-07-wise', 'wise', false),
  (current_date - 2, 'Comisión Wise',          15,   'out', 'EUR', 'comisiones',      'Wise Payments Ltd',       'BE1234567890',              'test-2026-07-wise', 'wise', false);

commit;
