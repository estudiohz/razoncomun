-- 0046_push_subscriptions.sql
-- Web Push (petición de Sergio, 07/08/2026): notificaciones push reales cuando
-- la web está instalada como PWA, además del centro in-app (`notifications`)
-- que ya existía. `notification_preferences.push_enabled` (0014) ya existía
-- como columna pero no se usaba en ningún sitio — se convierte ahora en el
-- interruptor real del opt-in.
--
-- Una fila por dispositivo/navegador suscrito (un usuario puede tener varios:
-- móvil + escritorio). El endpoint es único: reinstalar/resuscribir en el
-- mismo dispositivo actualiza la fila en vez de duplicarla.

begin;

create table public.push_subscriptions (
  id          uuid primary key default extensions.gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text null,
  created_at  timestamptz not null default now()
);

comment on table public.push_subscriptions is 'Suscripciones Web Push (una fila por dispositivo/navegador). El endpoint identifica el dispositivo ante el servicio push del navegador.';

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- 100% propio: el usuario gestiona sus propias suscripciones (alta al aceptar
-- el permiso del navegador, baja al desactivar). El envío real lo hace el
-- servidor con la service role (bypassa RLS), no necesita policy de select
-- ajena.
create policy push_subscriptions_all_own
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
