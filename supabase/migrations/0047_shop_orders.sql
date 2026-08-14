-- 0047_shop_orders.sql
-- Tienda de merchandising con Printful (docs/tecnico/tienda-printful.md, ola T0).
--
-- Registro MÍNIMO de pedidos: la web no es el sistema de gestión de la tienda.
-- El catálogo vive en Printful (D-T1, sin réplica local) y el pedido real vive
-- en Printful + Stripe. Esta tabla existe solo para tres cosas:
--   1. Idempotencia dura del webhook: `stripe_session_id` es UNIQUE, así que
--      dos entregas del mismo evento no pueden crear dos pedidos (D-T6). Es la
--      segunda red además del registro de `event.id` de lib/stripe/eventos.ts;
--      aquí un duplicado cuesta dinero real (se imprime y se envía dos veces).
--   2. Saber qué pasó si Printful falla DESPUÉS de que Stripe haya cobrado
--      (status='failed' + printful_error) -> reintento manual con trazabilidad.
--   3. Contabilidad: ingresos comerciales del partido (LO 8/2007).
--
-- D-T8: NO se guarda la dirección de envío. Ya la tratan Stripe y Printful,
-- que son los que la necesitan; duplicarla aquí sumaría riesgo RGPD sin
-- aportar nada. El email sí, porque es la única forma de localizar un pedido
-- si el comprador escribe sin el enlace de Stripe.

begin;

create table public.shop_orders (
  id                 uuid primary key default extensions.gen_random_uuid(),
  -- Idempotencia (D-T6): el id de la sesión de Checkout identifica la compra.
  stripe_session_id  text not null unique,
  -- Se rellena cuando Printful acepta el pedido; null mientras no exista.
  printful_order_id  bigint null,
  -- El comprador puede ser invitado (D-T9): user_id null y solo email.
  user_id            uuid null references public.profiles(id) on delete set null,
  email              text not null,
  total_cents        bigint not null check (total_cents >= 0),
  shipping_cents     bigint not null default 0 check (shipping_cents >= 0),
  currency           text not null default 'EUR',
  status             text not null default 'paid'
                       check (status in ('paid', 'sent_to_printful', 'confirmed', 'failed')),
  -- Mensaje de error de Printful si el envío del pedido falló (para reintento
  -- manual sabiendo qué pasó, no un fallo mudo tras haber cobrado).
  printful_error     text null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.shop_orders is 'Pedidos de la tienda (Printful). Registro mínimo: sin dirección de envío (D-T8), solo lo necesario para idempotencia, soporte y contabilidad.';
comment on column public.shop_orders.stripe_session_id is 'UNIQUE: impide que un webhook reentregado cree un segundo pedido (D-T6).';

create index shop_orders_user_idx on public.shop_orders(user_id) where user_id is not null;
create index shop_orders_status_idx on public.shop_orders(status);
create index shop_orders_created_idx on public.shop_orders(created_at desc);

create trigger shop_orders_set_updated_at
  before update on public.shop_orders
  for each row execute function public.set_updated_at();

alter table public.shop_orders enable row level security;

-- Solo administración. El comprador NO consulta su pedido por aquí (puede ser
-- invitado y no tener sesión): recibe el email de Stripe y el de Printful con
-- el seguimiento. Escritura: exclusivamente service_role desde el webhook
-- (bypassa RLS) -- no hay policy de insert/update para nadie más, ni siquiera
-- admin, para que un pedido nunca se cree "a mano" desde el navegador.
create policy shop_orders_select_admin
  on public.shop_orders for select
  to authenticated
  using (public.is_admin());

commit;
