-- 0079 · Newsletter N2 — eventos de Brevo y estadísticas por campaña.
--
-- docs/tecnico/newsletter.md (D-N4). Brevo llama a /api/newsletter/brevo por
-- cada evento (entregado, abierto, clic, rebote, baja, spam…) y devuelve la
-- cabecera `X-Mailin-custom` que pusimos al enviar: así cada evento se casa
-- con su fila de `newsletter_envios`.

begin;

create table if not exists public.newsletter_eventos (
  id            uuid primary key default extensions.gen_random_uuid(),
  envio_id      uuid null references public.newsletter_envios(id) on delete cascade,
  campaign_id   uuid null references public.newsletter_campaigns(id) on delete cascade,
  tipo          text not null,
  email         text null,
  url           text null,
  ocurrido_at   timestamptz not null default now(),
  -- Brevo reintenta los webhooks: la misma terna no se cuenta dos veces.
  huella        text not null unique,
  payload       jsonb not null default '{}'::jsonb,
  creado_at     timestamptz not null default now()
);

create index if not exists newsletter_eventos_campaign_idx on public.newsletter_eventos (campaign_id, tipo);
create index if not exists newsletter_eventos_envio_idx on public.newsletter_eventos (envio_id);

alter table public.newsletter_eventos enable row level security;
drop policy if exists newsletter_eventos_admin on public.newsletter_eventos;
create policy newsletter_eventos_admin on public.newsletter_eventos
  for select to authenticated using (public.is_admin() or public.is_editor());

-- Estadísticas por campaña. Aperturas y clics en ÚNICOS (personas, no
-- eventos): un mismo correo abierto cinco veces cuenta una. Invoker: la RLS
-- de las tres tablas decide quién lo ve.
create or replace function public.newsletter_stats()
returns table (
  campaign_id  uuid,
  enviados     bigint,
  pendientes   bigint,
  fallidos     bigint,
  omitidos     bigint,
  entregados   bigint,
  abiertos     bigint,
  clics        bigint,
  rebotes      bigint,
  bajas        bigint,
  spam         bigint
)
language sql stable security invoker set search_path = public as $$
  select
    c.id,
    count(distinct e.id) filter (where e.estado = 'enviado'),
    count(distinct e.id) filter (where e.estado = 'pendiente'),
    count(distinct e.id) filter (where e.estado = 'fallido'),
    count(distinct e.id) filter (where e.estado = 'omitido'),
    count(distinct ev.envio_id) filter (where ev.tipo = 'delivered'),
    count(distinct ev.envio_id) filter (where ev.tipo in ('opened', 'unique_opened', 'click')),
    count(distinct ev.envio_id) filter (where ev.tipo = 'click'),
    count(distinct ev.envio_id) filter (where ev.tipo in ('hard_bounce', 'soft_bounce', 'invalid_email', 'blocked')),
    count(distinct ev.envio_id) filter (where ev.tipo = 'unsubscribed'),
    count(distinct ev.envio_id) filter (where ev.tipo = 'spam')
  from public.newsletter_campaigns c
  left join public.newsletter_envios e on e.campaign_id = c.id
  left join public.newsletter_eventos ev on ev.envio_id = e.id
  group by c.id;
$$;

grant execute on function public.newsletter_stats() to authenticated;

commit;
