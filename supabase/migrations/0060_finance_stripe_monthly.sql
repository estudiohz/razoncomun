-- 0060_finance_stripe_monthly.sql
-- Ingresos reales de Stripe por mes para /cuentas (encargo de Sergio, 22/10/2026:
-- "conectar Stripe para mostrar la realidad", sincronización diaria).
--
-- Se alimenta desde /api/cuentas/sync (lee balance_transactions de Stripe y hace
-- upsert por mes). Solo cifras agregadas: ningún dato de socio ni de cliente.
-- Aditiva: no toca finance_snapshots ni finance_expenses.

begin;

create table public.finance_stripe_monthly (
  month          date primary key,            -- primer día del mes (Europe/Madrid)
  gross_cents    bigint not null default 0,   -- cobrado (charges/payments), antes de comisión
  fee_cents      bigint not null default 0,   -- comisiones de Stripe
  refund_cents   bigint not null default 0,   -- devoluciones (positivo)
  charges_count  int    not null default 0,   -- nº de cobros
  members_active int,                         -- socios activos al sincronizar (solo mes en curso)
  synced_at      timestamptz not null default now()
);

comment on table public.finance_stripe_monthly is
  'Agregado mensual de Stripe para /cuentas. Neto = gross - fee - refund. Escritura solo service_role (sync diario); lectura pública, sin datos personales.';

alter table public.finance_stripe_monthly enable row level security;

create policy finance_stripe_monthly_select_public
  on public.finance_stripe_monthly for select
  to anon, authenticated
  using (true);

-- Sin policy de escritura: solo service_role (bypasa RLS). Se revoca por si el
-- esquema concede "all" por defecto a nuevas tablas.
revoke insert, update, delete on public.finance_stripe_monthly from anon, authenticated;

commit;
