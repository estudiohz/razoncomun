-- 0023_finance_movements.sql
-- Encargo de Sergio (20/07/2026): (1) diferenciar gastos fijo/recurrente/puntual en
-- finance_expenses, y (2) modelar la importación mensual del CSV de Wise
-- (finance_movements) con una proyección pública que NUNCA expone la contraparte
-- (nombre/IBAN de quien pagó o cobró). Publicar el dato de un donante particular es
-- un problema de RGPD (Art. 9) y de la LO 8/2007 de partidos políticos.
--
-- Migración puramente aditiva: no se dropea ni se reescribe nada de 0011_finance.sql.
-- Las filas existentes de finance_expenses migran a expense_type='puntual' por defecto
-- (Sergio no especificó reclasificar el histórico; queda para que tesorería lo revise
-- fila a fila si alguna era en realidad fija/recurrente).

begin;

-- ============================================================================
-- 1. finance_expenses: tipo de gasto (fijo | recurrente | puntual)
-- ============================================================================

alter table public.finance_expenses
  add column expense_type text not null default 'puntual'
    check (expense_type in ('fijo', 'recurrente', 'puntual'));

comment on column public.finance_expenses.expense_type is
  'fijo = coste mensual estable (alquiler, dominio...); recurrente = periódico pero variable en importe/fecha; puntual = one-off. Default puntual para el histórico ya cargado.';

-- ============================================================================
-- 2. finance_movements: importación mensual de movimientos del CSV de Wise
-- ============================================================================
-- Guarda TODO lo que trae el CSV, incluida la contraparte (donante o proveedor) en
-- counterparty_name/counterparty_ref. Esas dos columnas son el dato sensible del
-- diseño: NUNCA se exponen fuera de admin/tesorería. Lo público es la vista
-- finance_movements_public de más abajo, sin esas columnas y solo de las filas que
-- un admin ha marcado published=true (no todo el CSV se publica automáticamente).

create table public.finance_movements (
  id                 uuid primary key default extensions.gen_random_uuid(),
  dated              date not null,
  description        text not null,
  amount_cents       bigint not null check (amount_cents >= 0),
  direction          text not null check (direction in ('in', 'out')),
  currency           text not null default 'EUR',
  category           text,
  counterparty_name  text,             -- ⚠️ SENSIBLE (RGPD Art. 9 / LO 8/2007): jamás público
  counterparty_ref   text,             -- ⚠️ SENSIBLE (IBAN u otra referencia): jamás público
  import_batch       text not null,    -- agrupa una importación mensual (permite identificarla/rehacerla)
  source             text not null default 'wise',
  published          boolean not null default false,  -- gate de aprobación manual por admin/tesorería
  created_at         timestamptz not null default now()
);

comment on table public.finance_movements is
  'Movimientos importados del CSV mensual de Wise. RAW (con contraparte): solo admin/tesorería. Proyección pública sin datos personales: finance_movements_public (published=true).';
comment on column public.finance_movements.counterparty_name is
  'Nombre de quien pagó/cobró (donante particular o proveedor). NUNCA se expone en finance_movements_public ni a ningún rol distinto de admin/tesorería.';
comment on column public.finance_movements.counterparty_ref is
  'Referencia de la contraparte tal cual la trae Wise (típicamente IBAN). Mismo tratamiento que counterparty_name: nunca público.';
comment on column public.finance_movements.import_batch is
  'Identificador de la tanda de importación mensual (p.ej. "2026-07-wise"), para poder auditar o rehacer una carga completa.';
comment on column public.finance_movements.published is
  'Un movimiento importado NO aparece en /cuentas hasta que admin/tesorería lo revisa y marca published=true.';

create index finance_movements_dated_idx on public.finance_movements (dated desc);
create index finance_movements_import_batch_idx on public.finance_movements (import_batch);
-- Índice parcial para la consulta real de /cuentas (vía la vista pública): solo lo publicado.
create index finance_movements_published_dated_idx on public.finance_movements (dated desc) where published;

alter table public.finance_movements enable row level security;

-- Lectura y escritura del RAW (incluida contraparte): SOLO admin/tesorería.
-- No existe ninguna policy para anon ni para authenticated "a secas": aunque el
-- rol hereda el GRANT amplio del esquema (alter default privileges, ver
-- supabase/README.md), sin policy que la cubra la fila queda denegada por
-- defecto. anon en particular no tiene NINGÚN acceso a esta tabla, ni siquiera
-- a movimientos publicados: para eso está la vista pública de más abajo.
create policy finance_movements_select_treasury
  on public.finance_movements for select
  to authenticated
  using (public.is_admin() or public.is_treasurer());

create policy finance_movements_insert_treasury
  on public.finance_movements for insert
  to authenticated
  with check (public.is_admin() or public.is_treasurer());

create policy finance_movements_update_treasury
  on public.finance_movements for update
  to authenticated
  using (public.is_admin() or public.is_treasurer())
  with check (public.is_admin() or public.is_treasurer());

create policy finance_movements_delete_treasury
  on public.finance_movements for delete
  to authenticated
  using (public.is_admin() or public.is_treasurer());

-- ============================================================================
-- 3. Proyección pública: SIN contraparte, solo movimientos aprobados
-- ============================================================================
-- La vista la crea/posee el rol de la migración (`postgres`, con BYPASSRLS aquí
-- en desarrollo: rolbypassrls=true, verificado en vivo). Postgres resuelve el
-- acceso de una vista a sus tablas subyacentes con los privilegios de la
-- propietaria, así que esta vista SÍ puede leer finance_movements aunque anon no
-- tenga ninguna policy sobre la tabla base. El filtro published=true y la lista
-- de columnas de la vista son la ÚNICA puerta pública: la tabla base sigue sin
-- ser accesible directamente vía /rest/v1/finance_movements para anon (la
-- policy de arriba solo cubre a authenticated admin/tesorería).
-- security_barrier=true evita que el planificador cuele funciones/operadores del
-- cliente antes del where published=true (defensa en profundidad estándar de
-- Postgres para vistas de seguridad).
create view public.finance_movements_public
  with (security_barrier = true) as
  select
    id,
    dated,
    description,
    amount_cents,
    direction,
    currency,
    category
  from public.finance_movements
  where published = true;

comment on view public.finance_movements_public is
  'Proyección pública de finance_movements para /cuentas: SIN counterparty_name/counterparty_ref, SIN import_batch/source, solo filas published=true. Consumir esta vista desde el frontend, nunca la tabla base.';

-- Defensa en profundidad: aunque el esquema conceda "all" por defecto a nuevas
-- relaciones, se revoca explícitamente todo y se concede solo SELECT. Al ser una
-- vista de una sola tabla sin agregados podría ser "auto-updatable" para
-- Postgres; sin este revoke/grant explícito un INSERT/UPDATE/DELETE contra la
-- vista podría colarse hasta la tabla base.
revoke all on public.finance_movements_public from public, anon, authenticated;
grant select on public.finance_movements_public to anon, authenticated;

commit;
