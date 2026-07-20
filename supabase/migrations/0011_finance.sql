-- 0011_finance.sql
-- Transparencia financiera: finance_snapshots, finance_expenses. Sync n8n desde Stripe+Wise.

begin;

create table public.finance_snapshots (
  id                  uuid primary key default extensions.gen_random_uuid(),
  taken_at            timestamptz not null,
  balance_cents       int not null,     -- saldo Wise
  income_month_cents  int not null,     -- cuotas del mes
  members_count       int not null
);

create table public.finance_expenses (
  id            uuid primary key default extensions.gen_random_uuid(),
  dated         date not null,
  concept       text not null,
  amount_cents  int not null,
  category      text not null
);

create index finance_snapshots_taken_at_idx on public.finance_snapshots(taken_at desc);
create index finance_expenses_dated_idx on public.finance_expenses(dated desc);

alter table public.finance_snapshots enable row level security;
alter table public.finance_expenses enable row level security;

-- Lectura pública (agregada); escritura SOLO service_role (sync n8n, ver I7).
create policy finance_snapshots_select_public
  on public.finance_snapshots for select
  to anon, authenticated
  using (true);

create policy finance_expenses_select_public
  on public.finance_expenses for select
  to anon, authenticated
  using (true);

commit;
