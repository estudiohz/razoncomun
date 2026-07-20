-- 0021_proposals_origin.sql
--
-- Distingue las propuestas OFICIALES del partido de las CIUDADANAS (D-019).
--
-- Decisión de Sergio al migrar el WordPress: las 7 "propuesta" del sitio
-- oficial (Propuesta Integral de Vivienda, 50 Áreas de despilfarro público…)
-- son documentos de posición ADOPTADOS por el partido, no propuestas nacidas
-- del ciclo ciudadano (seed → deliberation → voting → adopted).
--
-- El problema: sin marcador, una propuesta oficial adoptada y una ciudadana
-- que llegó a `status='adopted'` por votación serían indistinguibles. Eso
-- confundiría el relato — "esto lo decidieron los afiliados" vs "esto es
-- posición fundacional del partido". Para el partido del programa vivo, la
-- procedencia de cada propuesta adoptada importa y debe ser visible.
--
-- FIX: columna `origin` con dos valores. Por defecto 'citizen' — toda propuesta
-- creada por el ciclo normal es ciudadana; solo la importación y un acto
-- explícito de dirección marcan 'official'.
--
-- Cambio del orquestador sobre la zona de rc-02-datos (dueño del esquema):
-- columna aditiva con default, no rompe nada existente.

begin;

alter table public.proposals
  add column if not exists origin text not null default 'citizen'
    check (origin in ('citizen', 'official'));

comment on column public.proposals.origin is
  'Procedencia (D-019): citizen = nacida del ciclo ciudadano (seed→voting); '
  'official = documento de posición adoptado por la dirección del partido '
  '(p.ej. las importadas del WordPress oficial). Visible públicamente para no '
  'confundir "lo decidieron los afiliados" con "posición fundacional".';

-- Índice para listar rápido las oficiales (la web las mostrará en su sección).
create index if not exists proposals_official_idx
  on public.proposals (origin) where origin = 'official';

commit;
