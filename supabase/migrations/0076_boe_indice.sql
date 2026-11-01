-- 0076 · Auditoría — índice diario del BOE (contratos y otras disposiciones).
--
-- El BOE no tiene buscador por API: solo el sumario de cada día. Un job
-- diario (/api/auditoria/indexar-boe, schedule de Dokploy) guarda en
-- `boe_items` (0015) las secciones V-A (contratación del sector público) y
-- III (otras disposiciones: convenios, subvenciones…) para poder buscarlas
-- desde un caso. Se añade el órgano, el expediente y el enlace al XML, y el
-- título normalizado (sin tildes, en minúsculas) para buscar por palabras.

begin;

alter table public.boe_items
  add column if not exists departamento    text,
  add column if not exists expediente      text,
  add column if not exists seccion_codigo  text,
  add column if not exists url_xml         text;

-- Sin depender de la extensión unaccent: translate de las vocales con tilde.
alter table public.boe_items
  add column if not exists title_norm text generated always as (
    lower(translate(title, 'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙ', 'aeiouunaeiouunaeiouaeiou'))
  ) stored;

create index if not exists boe_items_expediente_idx on public.boe_items (expediente) where expediente is not null;
create index if not exists boe_items_seccion_fecha_idx on public.boe_items (seccion_codigo, published_date desc);
create index if not exists boe_items_title_norm_trgm on public.boe_items using gin (title_norm gin_trgm_ops);

commit;
