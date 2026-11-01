-- 0073 · Auditoría — mención del origen (reel, artículo o web).
--
-- Sergio (01-11-2026): las auditorías deben llevar la mención del reel
-- original; y el origen puede no ser un reel sino una URL (artículo, web).
-- Las columnas se llaman `reel_*` pero guardan cualquier origen; `reel_autor`
-- es el @usuario o el nombre del medio. El enlace y el autor se copian al caso (y no se leen de
-- `watchdog_sources`) porque la bandeja es interna y el caso es lo que se
-- publica: la RLS de `watchdog_alerts` ya deja ver al público solo lo
-- publicado. Publicar sin mención queda bloqueado por trigger.

begin;

alter table public.watchdog_alerts
  add column reel_url        text check (reel_url is null or reel_url ~* '^https?://'),
  add column reel_autor      text,      -- '@elrastrodeldinero'
  add column reel_autor_url  text check (reel_autor_url is null or reel_autor_url ~* '^https?://');

comment on column public.watchdog_alerts.reel_url is 'Reel (o publicación) original del que nace el caso. Se cita siempre en la ficha pública (0073).';
comment on column public.watchdog_alerts.reel_autor is 'Autor del reel original, p. ej. @elrastrodeldinero (0073).';

-- Relleno de los casos que ya existen: el enlace sale del envío del bot; el
-- autor, si el reel citaba El Rastro del Dinero.
update public.watchdog_alerts a
set reel_url = s.permalink
from public.watchdog_sources s
where a.source_id = s.id and a.reel_url is null and s.permalink ~* '^https?://';

update public.watchdog_alerts a
set reel_autor = '@elrastrodeldinero',
    reel_autor_url = 'https://www.instagram.com/elrastrodeldinero/'
from public.watchdog_sources s
where a.source_id = s.id
  and a.reel_autor is null
  and (coalesce(s.transcript, '') || ' ' || coalesce(s.message_text, '')) ~* '(el\s*rastro\s*del\s*dinero|elrastrodeldinero)';

-- Sin parámetros de seguimiento (?utm_source=…&srtk=…): es lo que se publica.
-- Solo Instagram y TikTok: en YouTube el `?v=` ES el enlace.
update public.watchdog_alerts
set reel_url = regexp_replace(reel_url, '[?#].*$', '')
where reel_url ~* '^https?://(www\.)?(instagram\.com|tiktok\.com)/' and reel_url ~ '[?#]';

-- Publicar exige la mención del reel original.
create or replace function public.watchdog_alerts_mencion_reel()
returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'published'
     and (coalesce(btrim(new.reel_url), '') = '' or coalesce(btrim(new.reel_autor), '') = '') then
    raise exception 'Un caso publicado debe citar su origen (enlace y autor o medio)';
  end if;
  return new;
end;
$$;

create trigger watchdog_alerts_mencion_reel
  before insert or update on public.watchdog_alerts
  for each row execute function public.watchdog_alerts_mencion_reel();

commit;
