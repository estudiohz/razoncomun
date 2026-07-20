-- 9002_finance_fixtures.sql
-- ⚠️⚠️⚠️ NUNCA EJECUTAR EN PRODUCCIÓN ⚠️⚠️⚠️
-- Datos de ejemplo para /cuentas (rc-07-afiliacion) mientras el workflow n8n
-- "finanzas-sync" (real, ver n8n/finanzas-sync.json) no está desplegado con
-- credenciales de Wise reales. Sin esto, la página pública quedaría en
-- blanco durante la demo/verificación. `finance_snapshots`/`finance_expenses`
-- son propiedad de rc-07 (0011_finance.sql), no de rc-02 — este seed vive en
-- test-data/ igual que el resto, mismo motivo: idempotente y purgable.
--
-- Importes ilustrativos coherentes con el presupuesto real del partido
-- (CLAUDE.md raíz: 0-30€/mes) y con los afiliados de prueba activos en
-- 9001_fixtures.sql (member_new, member_old, member_verified = 3 activos a
-- 5€/mes → aquí se redondea a 5 para simular algo de variación real).

begin;

delete from public.finance_snapshots where taken_at < now() + interval '1 hour'; -- limpia cualquier carga previa de prueba
delete from public.finance_expenses where dated <= current_date;

insert into public.finance_snapshots (taken_at, balance_cents, income_month_cents, members_count) values
  (now(), 182350, 2500, 5);

insert into public.finance_expenses (dated, concept, amount_cents, category) values
  (date_trunc('month', current_date)::date + 2,  'Dominio razoncomun.com',              1200, 'infraestructura'),
  (date_trunc('month', current_date)::date + 3,  'Hosting VPS (Dokploy)',               800,  'infraestructura'),
  (date_trunc('month', current_date)::date + 5,  'Créditos API de IA (redacción/moderación)', 480, 'herramientas'),
  (date_trunc('month', current_date)::date + 7,  'Email transaccional (Brevo, plan gratuito)', 0,   'herramientas'),
  (date_trunc('month', current_date)::date + 10, 'Comisiones Stripe (cobro de cuotas SEPA)',   38,  'comisiones');

commit;
