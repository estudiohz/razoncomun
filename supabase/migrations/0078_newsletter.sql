-- 0078 · Newsletter N1 — campañas y cola de envío.
--
-- docs/tecnico/newsletter.md (D-N4..D-N7). Una campaña es un correo
-- concreto (la encuesta de un mes, su recordatorio…); sus destinatarios se
-- congelan al crearla en `newsletter_envios`, que hace de cola: un worker
-- envía como máximo 250 al día (Brevo gratis: 300/día compartidos con el
-- login). Los eventos de Brevo (aperturas, clics, rebotes) llegan en N2.

begin;

create table if not exists public.newsletter_campaigns (
  id              uuid primary key default extensions.gen_random_uuid(),
  tipo            text not null check (tipo in ('encuesta_inicio', 'encuesta_recordatorio', 'manual')),
  mes             date not null check (mes = date_trunc('month', mes)::date),
  survey_id       uuid null references public.surveys(id) on delete set null,
  -- Contenido congelado tal y como salió (D-N7), con un destinatario de
  -- muestra: es lo que enseña el panel aunque luego cambie la plantilla.
  asunto          text not null,
  html            text not null,
  texto           text not null,
  estado          text not null default 'enviando' check (estado in ('enviando', 'enviada', 'cancelada')),
  destinatarios   integer not null default 0,
  creada_at       timestamptz not null default now(),
  enviada_at      timestamptz null,
  -- Si el cron corre dos veces el mismo día, la segunda no duplica nada.
  constraint newsletter_campaigns_unica unique (tipo, mes)
);

create table if not exists public.newsletter_envios (
  id              uuid primary key default extensions.gen_random_uuid(),
  campaign_id     uuid not null references public.newsletter_campaigns(id) on delete cascade,
  user_id         uuid null references public.profiles(id) on delete set null,
  email           text not null,
  estado          text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido', 'omitido')),
  intentos        smallint not null default 0,
  enviado_at      timestamptz null,
  message_id      text null,
  error           text null,
  creado_at       timestamptz not null default now(),
  constraint newsletter_envios_unico unique (campaign_id, user_id)
);

create index if not exists newsletter_envios_pendientes_idx
  on public.newsletter_envios (creado_at) where estado = 'pendiente';
create index if not exists newsletter_envios_enviado_at_idx
  on public.newsletter_envios (enviado_at) where enviado_at is not null;

-- Solo lo lee el admin (panel de N2). Las escrituras van con service role
-- (crons), que se salta la RLS.
alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_envios    enable row level security;

drop policy if exists newsletter_campaigns_admin on public.newsletter_campaigns;
create policy newsletter_campaigns_admin on public.newsletter_campaigns
  for select to authenticated using (public.is_admin() or public.is_editor());

drop policy if exists newsletter_envios_admin on public.newsletter_envios;
create policy newsletter_envios_admin on public.newsletter_envios
  for select to authenticated using (public.is_admin() or public.is_editor());

commit;
